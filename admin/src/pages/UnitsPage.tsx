import * as unitApi from '../api/unit.api';
import LookupManager, { type LookupApi } from '../components/LookupManager';

const api: LookupApi = {
  list: unitApi.listUnits,
  create: unitApi.createUnit,
  rename: unitApi.renameUnit,
  remove: unitApi.deleteUnit,
};

export default function UnitsPage() {
  return (
    <LookupManager
      title="Đơn vị đo"
      description="Đơn vị đo lường dùng chung cho thực phẩm (kg, g, lít, hộp...). Không thể xoá đơn vị đang được thực phẩm sử dụng."
      itemLabel="đơn vị"
      api={api}
    />
  );
}
