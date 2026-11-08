import * as categoryApi from '../api/category.api';
import LookupManager, { type LookupApi } from '../components/LookupManager';

const api: LookupApi = {
  list: categoryApi.listCategories,
  create: categoryApi.createCategory,
  rename: categoryApi.renameCategory,
  remove: categoryApi.deleteCategory,
};

export default function CategoriesPage() {
  return (
    <LookupManager
      title="Danh mục thực phẩm"
      description="Danh mục dùng chung toàn hệ thống để phân loại thực phẩm. Không thể xoá danh mục đang được thực phẩm sử dụng."
      itemLabel="danh mục"
      api={api}
    />
  );
}
