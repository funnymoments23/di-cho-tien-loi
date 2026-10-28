const Unit = require('../models/unit.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicLookup } = require('../utils/serializers');

/** GET /admin/unit — toàn bộ đơn vị đo, sắp xếp theo tên. */
const getUnits = async () => {
  const units = await Unit.find().sort({ name: 1 });
  return units.map(toPublicLookup);
};

/** POST /admin/unit — tạo đơn vị mới, tên không được trùng (00113). */
const createUnit = async ({ name }) => {
  if (await Unit.exists({ name })) throw fail(RC.UNIT_CREATE_EXISTS); // 00113

  try {
    const unit = await Unit.create({ name });
    return toPublicLookup(unit);
  } catch (err) {
    // Hai request tạo cùng tên đồng thời: unique index chặn ở DB.
    if (err.code === 11000) throw fail(RC.UNIT_CREATE_EXISTS); // 00113
    throw err;
  }
};

/**
 * PUT /admin/unit — đổi tên đơn vị.
 * `name` là tên cũ, `newName` là tên mới; không đổi sang tên đang có (00113).
 */
const updateUnit = async ({ name, newName }) => {
  if (name === newName) throw fail(RC.UNIT_UPDATE_SAME_NAME); // 00118

  const unit = await Unit.findOne({ name });
  if (!unit) throw fail(RC.UNIT_UPDATE_NOT_FOUND); // 00119

  const duplicate = await Unit.exists({ name: newName, _id: { $ne: unit._id } });
  if (duplicate) throw fail(RC.UNIT_UPDATE_NEW_NAME_EXISTS); // 00113 (409)

  unit.name = newName;
  try {
    await unit.save();
  } catch (err) {
    if (err.code === 11000) throw fail(RC.UNIT_UPDATE_NEW_NAME_EXISTS); // 00113 (409)
    throw err;
  }

  return toPublicLookup(unit);
};

/** DELETE /admin/unit — xoá đơn vị theo tên (00125 nếu không tồn tại). */
const deleteUnit = async ({ name }) => {
  const unit = await Unit.findOneAndDelete({ name });
  if (!unit) throw fail(RC.UNIT_DELETE_NOT_FOUND); // 00125
  return toPublicLookup(unit);
};

module.exports = {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
};
