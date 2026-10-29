const mongoose = require('mongoose');
const ShoppingList = require('../models/shoppingList.models');
const Task = require('../models/task.models');
const FridgeItem = require('../models/fridgeItem.models');
const FridgeEvent = require('../models/fridgeEvent.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');

// ===== Tham số thời gian =====
// Báo cáo dùng ngày theo giờ Việt Nam (UTC+7, không có DST). `from` / `to` nhận
// dạng YYYY-MM-DD; không truyền thì mặc định 30 ngày gần nhất.
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

// Cùng quy ước với cron nhắc hạn (jobs/expiryChecker.job.js).
const DEFAULT_NOTIFY_DAYS = 3;

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

/** Lấy nhóm hiện tại của người dùng; báo cáo luôn có phạm vi một nhóm. */
const loadGroupContext = async (userId) => {
  assertValidId(userId);
  const user = await User.findById(userId).select('groupId');
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  if (!user.groupId) throw fail(RC.REPORT_NOT_IN_GROUP); // 00385

  const group = await Group.findById(user.groupId);
  if (!group) {
    // groupId trỏ tới nhóm đã bị xoá (dữ liệu không nhất quán): dọn tham chiếu.
    await User.updateOne({ _id: user._id }, { $set: { groupId: null } });
    throw fail(RC.REPORT_NOT_IN_GROUP); // 00385
  }

  return { user, group };
};

/** Khoá ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm. */
const toDateKey = (date) =>
  new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

/** Cộng/trừ ngày trên khoá YYYY-MM-DD (không phụ thuộc múi giờ máy chủ). */
const shiftKey = (key, days) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
};

/**
 * Phân tích một ngày YYYY-MM-DD thành mốc 00:00 giờ Việt Nam.
 * Trả null nếu sai định dạng hoặc là ngày không tồn tại (2026-02-31).
 */
const parseDay = (value) => {
  if (!DATE_ONLY.test(value)) return null;

  const dayStart = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(dayStart.getTime()) || toDateKey(dayStart) !== value) return null;
  return dayStart;
};

const readDayParam = (value) => {
  if (value === undefined || value === null) return '';
  // Query lặp tham số (?from=a&from=b) không xác định được ý định -> báo lỗi.
  if (typeof value !== 'string') throw fail(RC.REPORT_INVALID_DATE_RANGE); // 00386
  return value.trim();
};

/**
 * Dựng khoảng thời gian [from, to] trọn ngày theo giờ Việt Nam.
 * `to` mặc định là hôm nay, `from` mặc định là 29 ngày trước `to`.
 */
const buildRange = (filters = {}) => {
  const fromText = readDayParam(filters.from);
  const toText = readDayParam(filters.to);

  const toKey = toText || toDateKey(new Date());
  const fromKey = fromText || shiftKey(toKey, -(DEFAULT_RANGE_DAYS - 1));

  const fromDay = parseDay(fromKey);
  const toDay = parseDay(toKey);
  if (!fromDay || !toDay || fromDay.getTime() > toDay.getTime()) {
    throw fail(RC.REPORT_INVALID_DATE_RANGE); // 00386
  }

  const days = Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) throw fail(RC.REPORT_INVALID_DATE_RANGE); // 00386

  return {
    from: fromDay,
    to: new Date(toDay.getTime() + DAY_MS - 1),
    fromKey,
    toKey,
    days,
  };
};

const rangePayload = (range) => ({ from: range.fromKey, to: range.toKey, days: range.days });

const enumerateDateKeys = (fromKey, days) =>
  Array.from({ length: days }, (_, index) => shiftKey(fromKey, index));

const isInRange = (date, range) => {
  if (!date) return false;
  const time = new Date(date).getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
};

/**
 * Một món được coi là "đã mua trong khoảng" khi đã tick và thời điểm tick nằm
 * trong khoảng. Dữ liệu cũ (tick trước khi có `completedAt`) vẫn được tính để
 * không làm sai lệch báo cáo lịch sử.
 */
const isCompletedInRange = (task, range) =>
  Boolean(task.isCompleted) && (!task.completedAt || isInRange(task.completedAt, range));

const sumBy = (items, field) =>
  items.reduce((total, item) => total + (Number(item[field]) || 0), 0);

const roundRate = (value) => Number(value.toFixed(4));

// ===== Báo cáo mua sắm =====

/**
 * GET /report/shopping — số danh sách / món cần mua và món đã mua trong khoảng.
 *
 * Nguồn dữ liệu: `ShoppingList` + `Task`. Vì `Task` mới có `completedAt`, báo cáo
 * lọc được chính xác món nào được tick trong khoảng. Danh sách bị xoá sẽ không
 * còn trong báo cáo (giới hạn của phương án B — xem docs/02 mục 3.3).
 */
const buildShoppingReport = async (groupId, range) => {
  const lists = await ShoppingList.find({ groupId })
    .select('name assignedTo createdAt')
    .populate({ path: 'assignedTo', select: 'name username' })
    .lean();

  const listIds = lists.map((list) => list._id);
  const tasks = listIds.length
    ? await Task.find({
        listId: { $in: listIds },
        // Lấy cả món tạo trong khoảng và món được tick trong khoảng (món cũ
        // hoàn thành muộn vẫn phải xuất hiện ở chuỗi theo ngày).
        $or: [
          { createdAt: { $gte: range.from, $lte: range.to } },
          { completedAt: { $gte: range.from, $lte: range.to } },
        ],
      })
        .select('listId foodId quantity isCompleted completedAt createdAt')
        .populate({
          path: 'foodId',
          select: 'name categoryId',
          populate: { path: 'categoryId', select: 'name' },
        })
        .lean()
    : [];

  const listsInRange = lists.filter((list) => isInRange(list.createdAt, range));
  const createdTasks = tasks.filter((task) => isInRange(task.createdAt, range));
  const completedTasks = tasks.filter((task) => isInRange(task.completedAt, range));

  const items = createdTasks.length;
  const completedItems = createdTasks.filter((task) => isCompletedInRange(task, range)).length;

  const summary = {
    lists: listsInRange.length,
    items,
    completedItems,
    completionRate: items === 0 ? 0 : roundRate(completedItems / items),
  };

  // Chuỗi theo ngày để FE vẽ biểu đồ; ngày không có dữ liệu vẫn trả về 0.
  const dateKeys = enumerateDateKeys(range.fromKey, range.days);
  const seriesMap = new Map(
    dateKeys.map((date) => [
      date,
      { date, lists: 0, itemsCreated: 0, itemsCompleted: 0 },
    ])
  );

  for (const list of listsInRange) {
    const entry = seriesMap.get(toDateKey(list.createdAt));
    if (entry) entry.lists += 1;
  }
  for (const task of createdTasks) {
    const entry = seriesMap.get(toDateKey(task.createdAt));
    if (entry) entry.itemsCreated += 1;
  }
  for (const task of completedTasks) {
    const entry = seriesMap.get(toDateKey(task.completedAt));
    if (entry) entry.itemsCompleted += 1;
  }

  // Thống kê theo danh mục thực phẩm.
  const categoryMap = new Map();
  for (const task of createdTasks) {
    const name = task.foodId?.categoryId?.name ?? 'Khác';
    if (!categoryMap.has(name)) {
      categoryMap.set(name, { category: name, items: 0, completedItems: 0 });
    }
    const entry = categoryMap.get(name);
    entry.items += 1;
    if (isCompletedInRange(task, range)) entry.completedItems += 1;
  }
  const byCategory = [...categoryMap.values()].sort(
    (a, b) => b.items - a.items || a.category.localeCompare(b.category, 'vi')
  );

  // Thống kê theo người được giao danh sách.
  const listById = new Map(lists.map((list) => [String(list._id), list]));
  const assigneeMap = new Map();
  for (const task of createdTasks) {
    const list = listById.get(String(task.listId));
    const assignee = list?.assignedTo ?? null;
    const key = assignee?._id ? String(assignee._id) : 'unassigned';

    if (!assigneeMap.has(key)) {
      assigneeMap.set(key, {
        userId: assignee?._id ?? null,
        name: assignee?.name ?? null,
        username: assignee?.username ?? null,
        listIds: new Set(),
        items: 0,
        completedItems: 0,
      });
    }

    const entry = assigneeMap.get(key);
    if (list) entry.listIds.add(String(list._id));
    entry.items += 1;
    if (isCompletedInRange(task, range)) entry.completedItems += 1;
  }
  const byAssignee = [...assigneeMap.values()]
    .map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      username: entry.username,
      lists: entry.listIds.size,
      items: entry.items,
      completedItems: entry.completedItems,
    }))
    .sort((a, b) => b.items - a.items);

  return {
    range: rangePayload(range),
    summary,
    series: dateKeys.map((date) => seriesMap.get(date)),
    byCategory,
    byAssignee,
  };
};

// ===== Báo cáo tiêu thụ / lãng phí (trên FridgeEvent) =====

const loadEvents = (groupId, range, actions) =>
  FridgeEvent.find({
    groupId,
    action: { $in: actions },
    createdAt: { $gte: range.from, $lte: range.to },
  }).lean();

const buildEventSeries = (events, range) => {
  const dateKeys = enumerateDateKeys(range.fromKey, range.days);
  const seriesMap = new Map(
    dateKeys.map((date) => [date, { date, items: 0, quantity: 0 }])
  );

  for (const event of events) {
    const entry = seriesMap.get(toDateKey(event.createdAt));
    if (!entry) continue;
    entry.items += 1;
    entry.quantity += Number(event.quantity) || 0;
  }

  return dateKeys.map((date) => seriesMap.get(date));
};

/** Gom sự kiện theo một trường (tên thực phẩm / danh mục / lý do). */
const groupEvents = (events, selector, extra = () => ({})) => {
  const map = new Map();
  for (const event of events) {
    const name = selector(event) ?? 'Khác';
    if (!map.has(name)) {
      map.set(name, { name, items: 0, quantity: 0, ...extra(event) });
    }
    const entry = map.get(name);
    entry.items += 1;
    entry.quantity += Number(event.quantity) || 0;
  }

  return [...map.values()].sort(
    (a, b) => b.quantity - a.quantity || b.items - a.items || a.name.localeCompare(b.name, 'vi')
  );
};

/** GET /report/consumption — thực phẩm dùng hết trước hạn. */
const buildConsumptionReport = async (groupId, range) => {
  const events = await loadEvents(groupId, range, ['consumed']);

  return {
    range: rangePayload(range),
    summary: {
      items: events.length,
      quantity: sumBy(events, 'quantity'),
    },
    series: buildEventSeries(events, range),
    byFood: groupEvents(events, (event) => event.foodName, (event) => ({
      unitName: event.unitName ?? null,
    })),
    byCategory: groupEvents(events, (event) => event.categoryName),
  };
};

/** GET /report/waste — thực phẩm bị bỏ vì hết hạn hoặc bỏ dù còn hạn. */
const buildWasteReport = async (groupId, range) => {
  const [wasteEvents, consumedEvents] = await Promise.all([
    loadEvents(groupId, range, ['expired', 'discarded']),
    loadEvents(groupId, range, ['consumed']),
  ]);

  const wastedQuantity = sumBy(wasteEvents, 'quantity');
  const consumedQuantity = sumBy(consumedEvents, 'quantity');
  const totalHandled = wastedQuantity + consumedQuantity;

  return {
    range: rangePayload(range),
    summary: {
      items: wasteEvents.length,
      quantity: wastedQuantity,
      consumedQuantity,
      // Tỉ lệ lãng phí trên tổng số lượng đã xử lý (tiêu thụ + bỏ đi).
      wasteRate: totalHandled === 0 ? 0 : roundRate(wastedQuantity / totalHandled),
    },
    series: buildEventSeries(wasteEvents, range),
    byReason: groupEvents(wasteEvents, (event) => event.action),
    byFood: groupEvents(wasteEvents, (event) => event.foodName, (event) => ({
      unitName: event.unitName ?? null,
    })),
    byCategory: groupEvents(wasteEvents, (event) => event.categoryName),
  };
};

// ===== Ảnh chụp tủ lạnh hiện tại =====

const notifyDays = () => {
  const raw = process.env.EXPIRY_NOTIFY_DAYS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_NOTIFY_DAYS;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_NOTIFY_DAYS;
};

const groupItems = (items, selector) => {
  const map = new Map();
  for (const item of items) {
    const name = selector(item) ?? 'Khác';
    if (!map.has(name)) map.set(name, { name, items: 0, quantity: 0 });
    const entry = map.get(name);
    entry.items += 1;
    entry.quantity += Number(item.quantity) || 0;
  }

  return [...map.values()].sort(
    (a, b) => b.items - a.items || a.name.localeCompare(b.name, 'vi')
  );
};

/**
 * GET /report/fridge — tình trạng tủ lạnh hiện tại (không phải dữ liệu lịch sử).
 * `status`: expired (đã qua ngày hết hạn) / expiringSoon (trong N ngày tới) / fresh.
 */
const buildFridgeSnapshot = async (groupId) => {
  const now = new Date();
  // `expiryDate` được tạo từ chuỗi YYYY-MM-DD (00:00 UTC) nên mốc "hôm nay"
  // cũng tính theo UTC, giống cron nhắc hạn.
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const soonEnd = new Date(startOfToday.getTime() + (notifyDays() + 1) * DAY_MS - 1);

  const items = await FridgeItem.find({ groupId })
    .populate({
      path: 'foodId',
      select: 'name categoryId unitId',
      populate: [
        { path: 'categoryId', select: 'name' },
        { path: 'unitId', select: 'name' },
      ],
    })
    .sort({ expiryDate: 1, createdAt: 1 })
    .lean();

  const enriched = items.map((item) => {
    const expiry = new Date(item.expiryDate);
    const status =
      expiry < startOfToday ? 'expired' : expiry <= soonEnd ? 'expiringSoon' : 'fresh';

    return {
      id: item._id,
      foodId: item.foodId?._id ?? null,
      foodName: item.foodId?.name ?? null,
      categoryName: item.foodId?.categoryId?.name ?? null,
      unitName: item.foodId?.unitId?.name ?? null,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      location: item.location ?? null,
      status,
    };
  });

  return {
    summary: {
      totalItems: enriched.length,
      totalQuantity: sumBy(enriched, 'quantity'),
      expiringSoon: enriched.filter((item) => item.status === 'expiringSoon').length,
      expired: enriched.filter((item) => item.status === 'expired').length,
    },
    byLocation: groupItems(enriched, (item) => item.location ?? 'Không xác định'),
    byCategory: groupItems(enriched, (item) => item.categoryName),
    items: enriched,
  };
};

// ===== API công khai =====

/** GET /report/overview — gộp 4 khối số liệu để màn hình Thống kê chỉ gọi 1 lần. */
const getOverview = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId);
  const range = buildRange(filters);

  const [shopping, consumption, waste, fridge] = await Promise.all([
    buildShoppingReport(group._id, range),
    buildConsumptionReport(group._id, range),
    buildWasteReport(group._id, range),
    buildFridgeSnapshot(group._id),
  ]);

  return {
    range: rangePayload(range),
    shopping: shopping.summary,
    consumption: consumption.summary,
    waste: waste.summary,
    fridge: fridge.summary,
  };
};

const getShoppingReport = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId);
  return buildShoppingReport(group._id, buildRange(filters));
};

const getConsumptionReport = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId);
  return buildConsumptionReport(group._id, buildRange(filters));
};

const getWasteReport = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId);
  return buildWasteReport(group._id, buildRange(filters));
};

const getFridgeReport = async (userId) => {
  const { group } = await loadGroupContext(userId);
  return buildFridgeSnapshot(group._id);
};

module.exports = {
  getOverview,
  getShoppingReport,
  getConsumptionReport,
  getWasteReport,
  getFridgeReport,
};
