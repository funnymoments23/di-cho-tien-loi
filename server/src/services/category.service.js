const Category = require('../models/category.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicLookup } = require('../utils/serializers');

/** GET /admin/category — toàn bộ danh mục, sắp xếp theo tên. */
const getCategories = async () => {
  const categories = await Category.find().sort({ name: 1 });
  return categories.map(toPublicLookup);
};

/** POST /admin/category — tạo danh mục mới, tên không được trùng (00132). */
const createCategory = async ({ name }) => {
  if (await Category.exists({ name })) throw fail(RC.CATEGORY_CREATE_EXISTS); // 00132

  try {
    const category = await Category.create({ name });
    return toPublicLookup(category);
  } catch (err) {
    // Hai request tạo cùng tên đồng thời: unique index chặn ở DB.
    if (err.code === 11000) throw fail(RC.CATEGORY_CREATE_EXISTS); // 00132
    throw err;
  }
};

/**
 * PUT /admin/category — đổi tên danh mục.
 * `name` là tên cũ, `newName` là tên mới; không đổi sang tên đang có (00138).
 */
const updateCategory = async ({ name, newName }) => {
  if (name === newName) throw fail(RC.CATEGORY_UPDATE_SAME_NAME); // 00137

  const category = await Category.findOne({ name });
  if (!category) throw fail(RC.CATEGORY_UPDATE_NOT_FOUND); // 00138

  const duplicate = await Category.exists({ name: newName, _id: { $ne: category._id } });
  if (duplicate) throw fail(RC.CATEGORY_UPDATE_NEW_NAME_EXISTS); // 00138 (409)

  category.name = newName;
  try {
    await category.save();
  } catch (err) {
    if (err.code === 11000) throw fail(RC.CATEGORY_UPDATE_NEW_NAME_EXISTS); // 00138 (409)
    throw err;
  }

  return toPublicLookup(category);
};

/** DELETE /admin/category — xoá danh mục theo tên (00143 nếu không tồn tại). */
const deleteCategory = async ({ name }) => {
  const category = await Category.findOneAndDelete({ name });
  if (!category) throw fail(RC.CATEGORY_DELETE_NOT_FOUND); // 00143
  return toPublicLookup(category);
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
