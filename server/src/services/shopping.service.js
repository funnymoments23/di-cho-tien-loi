const mongoose = require('mongoose');
const ShoppingList = require('../models/shoppingList.models');
const Task = require('../models/task.models');
const Food = require('../models/food.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicTask, toPublicShoppingList } = require('../utils/serializers');

// Trả kèm người được giao / người tạo để client hiển thị trực tiếp.
const LIST_POPULATE = [
  { path: 'assignedTo', select: 'name username' },
  { path: 'createdBy', select: 'name username' },
];

// Trả kèm tên / ảnh / đơn vị của thực phẩm trong từng món.
const TASK_POPULATE = [
  {
    path: 'foodId',
    select: 'name image unitId',
    populate: { path: 'unitId', select: 'name' },
  },
];

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

// Body Joi đã trim; hàm này phòng trường hợp service được gọi trực tiếp và
// chuẩn hoá cả giá trị null/không phải chuỗi.
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Lấy nhóm hiện tại của người dùng.
 * Mỗi nhóm API có mã "chưa vào nhóm" riêng, nên mã được truyền vào.
 */
const loadGroupContext = async (userId, notInGroupCode) => {
  assertValidId(userId);
  const user = await User.findById(userId).select('groupId');
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  if (!user.groupId) throw fail(notInGroupCode);

  const group = await Group.findById(user.groupId);
  if (!group) {
    // groupId trỏ tới nhóm đã bị xoá (dữ liệu không nhất quán): dọn tham chiếu.
    await User.updateOne({ _id: user._id }, { $set: { groupId: null } });
    throw fail(notInGroupCode);
  }

  return { user, group };
};

/**
 * Lấy nhóm và bắt buộc người dùng là trưởng nhóm.
 * Đa số nhóm API shopping dùng cùng một mã cho cả hai trường hợp, nhưng vẫn
 * tách tham số để dễ đổi nếu đặc tả cấp mã riêng.
 */
const loadGroupAdminContext = async (userId, notInGroupCode, notAdminCode) => {
  const { user, group } = await loadGroupContext(userId, notInGroupCode);
  if (!group.adminId.equals(user._id)) throw fail(notAdminCode);
  return { user, group };
};

const isMemberOfGroup = (group, userId) =>
  group.members.some((memberId) => memberId.equals(userId));

const populateList = async (list) => {
  await list.populate(LIST_POPULATE);
  return toPublicShoppingList(list);
};

/**
 * GET /shopping/task — mọi danh sách đi chợ của nhóm, kèm các món cần mua.
 * Sắp xếp theo ngày đi chợ gần nhất; danh sách chưa chốt ngày nằm cuối.
 */
const getShoppingLists = async (userId) => {
  const { group } = await loadGroupContext(userId, RC.TASK_GET_NOT_IN_GROUP); // 00288

  const lists = await ShoppingList.find({ groupId: group._id })
    .populate(LIST_POPULATE)
    .sort({ date: 1, createdAt: 1 });

  const tasks = await Task.find({ listId: { $in: lists.map((list) => list._id) } })
    .populate(TASK_POPULATE)
    .sort({ createdAt: 1, _id: 1 });

  const tasksByList = new Map();
  for (const task of tasks) {
    const key = task.listId.toString();
    if (!tasksByList.has(key)) tasksByList.set(key, []);
    tasksByList.get(key).push(task);
  }

  return lists.map((list) =>
    toPublicShoppingList(list, tasksByList.get(list._id.toString()) ?? [])
  );
};

/**
 * POST /shopping — trưởng nhóm tạo danh sách và giao cho một thành viên.
 * Thứ tự kiểm tra: quyền trưởng nhóm (00243) -> username tồn tại (00245)
 * -> người được giao thuộc nhóm (00246).
 */
const createShoppingList = async (userId, { name, assignToUsername, note, date }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.SHOPPING_CREATE_UNAUTHORIZED, // 00243 — chưa vào nhóm
    RC.SHOPPING_CREATE_UNAUTHORIZED  // 00243 — không phải trưởng nhóm
  );

  const assignee = await User.findOne({ username: normalizeText(assignToUsername) });
  if (!assignee) throw fail(RC.SHOPPING_CREATE_ASSIGNEE_NOT_FOUND); // 00245
  if (!isMemberOfGroup(group, assignee._id)) {
    throw fail(RC.SHOPPING_CREATE_CANNOT_ASSIGN); // 00246
  }

  const list = await ShoppingList.create({
    name,
    groupId: group._id,
    assignedTo: assignee._id,
    note: normalizeText(note) || null,
    date: date ?? null,
    createdBy: user._id,
  });

  return populateList(list);
};

/**
 * PUT /shopping — sửa tên / người được giao / ghi chú / ngày.
 * Chỉ trưởng nhóm của nhóm sở hữu danh sách mới được sửa.
 */
const updateShoppingList = async (
  userId,
  { listId, newName, newAssignToUsername, newNote, newDate }
) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.SHOPPING_UPDATE_NOT_GROUP_ADMIN, // 00258
    RC.SHOPPING_UPDATE_NOT_GROUP_ADMIN  // 00258
  );

  const hasUpdate =
    newName !== undefined ||
    newAssignToUsername !== undefined ||
    newNote !== undefined ||
    newDate !== undefined;
  if (!hasUpdate) throw fail(RC.SHOPPING_UPDATE_NEED_ONE_FIELD); // 00252

  const list = await ShoppingList.findById(listId);
  if (!list) throw fail(RC.SHOPPING_UPDATE_LIST_NOT_FOUND); // 00260
  if (!list.groupId.equals(group._id)) throw fail(RC.SHOPPING_UPDATE_NOT_LIST_ADMIN); // 00261

  if (newAssignToUsername !== undefined) {
    const assignee = await User.findOne({ username: normalizeText(newAssignToUsername) });
    if (!assignee) throw fail(RC.SHOPPING_UPDATE_USER_NOT_FOUND); // 00262
    if (!isMemberOfGroup(group, assignee._id)) {
      throw fail(RC.SHOPPING_UPDATE_CANNOT_ASSIGN); // 00263
    }
    list.assignedTo = assignee._id;
  }

  if (newName !== undefined) list.name = newName;
  if (newNote !== undefined) list.note = normalizeText(newNote) || null;
  if (newDate !== undefined) list.date = newDate ?? null;

  await list.save();
  return populateList(list);
};

/**
 * DELETE /shopping — xoá danh sách và toàn bộ món bên trong.
 * Chỉ trưởng nhóm của nhóm sở hữu danh sách mới được xoá.
 */
const deleteShoppingList = async (userId, { listId }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.SHOPPING_DELETE_NOT_GROUP_ADMIN, // 00270
    RC.SHOPPING_DELETE_NOT_GROUP_ADMIN  // 00270
  );

  const list = await ShoppingList.findById(listId).populate(LIST_POPULATE);
  if (!list) throw fail(RC.SHOPPING_DELETE_LIST_NOT_FOUND); // 00272
  if (!list.groupId.equals(group._id)) throw fail(RC.SHOPPING_DELETE_NOT_LIST_ADMIN); // 00273

  const tasks = await Task.find({ listId: list._id })
    .populate(TASK_POPULATE)
    .sort({ createdAt: 1, _id: 1 });

  const data = toPublicShoppingList(list, tasks);
  await Task.deleteMany({ listId: list._id });
  await ShoppingList.deleteOne({ _id: list._id });

  return data;
};

/**
 * POST /shopping/task — thêm một mảng món vào danh sách.
 * Kiểm tra: quyền trưởng nhóm (00281) -> danh sách tồn tại (00283)
 * -> danh sách thuộc nhóm (00284) -> thực phẩm tồn tại (00285)
 * -> trùng trong mảng / đã có trong danh sách (00285x).
 */
const createTasks = async (userId, { listId, tasks }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.TASK_CREATE_NOT_GROUP_ADMIN, // 00281
    RC.TASK_CREATE_NOT_GROUP_ADMIN  // 00281
  );

  const list = await ShoppingList.findById(listId);
  if (!list) throw fail(RC.TASK_CREATE_LIST_NOT_FOUND); // 00283
  if (!list.groupId.equals(group._id)) throw fail(RC.TASK_CREATE_NOT_LIST_ADMIN); // 00284

  const names = tasks.map((task) => normalizeText(task.foodName));
  const foods = await Food.find({ groupId: group._id, name: { $in: names } });
  const foodByName = new Map(foods.map((food) => [food.name, food]));

  const missingName = names.find((name) => !foodByName.has(name));
  if (missingName !== undefined) throw fail(RC.TASK_CREATE_FOOD_NOT_FOUND); // 00285

  // Cùng một thực phẩm lặp lại trong mảng gửi lên.
  if (new Set(names).size !== names.length) {
    throw fail(RC.TASK_CREATE_FOOD_ALREADY_IN_LIST); // 00285x
  }

  // Thực phẩm đã có sẵn trong danh sách này.
  const existingFoodIds = foods.map((food) => food._id);
  if (await Task.exists({ listId: list._id, foodId: { $in: existingFoodIds } })) {
    throw fail(RC.TASK_CREATE_FOOD_ALREADY_IN_LIST); // 00285x
  }

  try {
    const created = await Task.insertMany(
      tasks.map((task, index) => ({
        listId: list._id,
        foodId: foodByName.get(names[index])._id,
        quantity: task.quantity,
        isCompleted: false,
      }))
    );

    await Task.populate(created, TASK_POPULATE);
    return created.map(toPublicTask);
  } catch (err) {
    // Hai request thêm cùng món đồng thời: unique index chặn ở DB.
    if (err.code === 11000) throw fail(RC.TASK_CREATE_FOOD_ALREADY_IN_LIST); // 00285x
    throw err;
  }
};

/**
 * PUT /shopping/task — sửa tên thực phẩm và/hoặc số lượng của một món.
 * Chỉ trưởng nhóm của nhóm sở hữu danh sách mới được sửa.
 */
const updateTask = async (userId, { taskId, newFoodName, newQuantity }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.TASK_UPDATE_NOT_GROUP_ADMIN, // 00307
    RC.TASK_UPDATE_NOT_GROUP_ADMIN  // 00307
  );

  if (newFoodName === undefined && newQuantity === undefined) {
    throw fail(RC.TASK_UPDATE_NEED_ONE_FIELD); // 00302
  }

  const task = await Task.findById(taskId);
  if (!task) throw fail(RC.TASK_UPDATE_NOT_FOUND); // 00306

  const list = await ShoppingList.findById(task.listId);
  if (!list || !list.groupId.equals(group._id)) {
    throw fail(RC.TASK_UPDATE_NOT_FOUND); // 00306 — món của nhóm khác
  }

  if (newFoodName !== undefined) {
    const food = await Food.findOne({
      groupId: group._id,
      name: normalizeText(newFoodName),
    });
    if (!food) throw fail(RC.TASK_UPDATE_FOOD_NOT_FOUND); // 00308

    if (!food._id.equals(task.foodId)) {
      if (
        await Task.exists({
          listId: task.listId,
          foodId: food._id,
          _id: { $ne: task._id },
        })
      ) {
        throw fail(RC.TASK_UPDATE_FOOD_ALREADY_IN_LIST); // 00309
      }
      task.foodId = food._id;
    }
  }

  if (newQuantity !== undefined) task.quantity = newQuantity;

  try {
    await task.save();
  } catch (err) {
    if (err.code === 11000) throw fail(RC.TASK_UPDATE_FOOD_ALREADY_IN_LIST); // 00309
    throw err;
  }

  await task.populate(TASK_POPULATE);
  return toPublicTask(task);
};

/** DELETE /shopping/task — xoá một món khỏi danh sách. */
const deleteTask = async (userId, { taskId }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.TASK_DELETE_NOT_GROUP_ADMIN, // 00297
    RC.TASK_DELETE_NOT_GROUP_ADMIN  // 00297
  );

  const task = await Task.findById(taskId).populate(TASK_POPULATE);
  if (!task) throw fail(RC.TASK_DELETE_NOT_FOUND); // 00296

  const list = await ShoppingList.findById(task.listId);
  if (!list || !list.groupId.equals(group._id)) {
    throw fail(RC.TASK_DELETE_NOT_FOUND); // 00296 — món của nhóm khác
  }

  const data = toPublicTask(task);
  await Task.deleteOne({ _id: task._id });
  return data;
};

/**
 * PATCH /shopping/task/:taskId/complete — đánh dấu đã mua xong.
 * API bổ sung (docs/02 mục 3.5) nên mọi thành viên trong nhóm đều tick được,
 * không chỉ trưởng nhóm; mã dùng lại 00312 của "cập nhật nhiệm vụ".
 */
const completeTask = async (userId, taskId, { isCompleted }) => {
  const { group } = await loadGroupContext(userId, RC.TASK_GET_NOT_IN_GROUP); // 00288

  if (!mongoose.isValidObjectId(taskId)) throw fail(RC.TASK_UPDATE_MISSING_TASK_ID); // 00301

  const task = await Task.findById(taskId);
  if (!task) throw fail(RC.TASK_UPDATE_NOT_FOUND); // 00306

  const list = await ShoppingList.findById(task.listId);
  if (!list || !list.groupId.equals(group._id)) {
    throw fail(RC.TASK_UPDATE_NOT_FOUND); // 00306 — món của nhóm khác
  }

  task.isCompleted = isCompleted;
  // Báo cáo mua sắm lọc theo thời điểm tick, không dựa vào updatedAt.
  task.completedAt = isCompleted ? new Date() : null;
  await task.save();
  await task.populate(TASK_POPULATE);
  return toPublicTask(task);
};

module.exports = {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  createTasks,
  updateTask,
  deleteTask,
  completeTask,
};
