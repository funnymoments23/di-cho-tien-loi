import { request } from './client';
import type {
  ReportConsumption,
  ReportFridge,
  ReportOverview,
  ReportRangeFilter,
  ReportShopping,
  ReportWaste,
} from '../types/models';

const rangeParams = (range?: ReportRangeFilter) => ({
  from: range?.from,
  to: range?.to,
});

export const reportApi = {
  overview: (range?: ReportRangeFilter) =>
    request<ReportOverview>({
      url: '/report/overview',
      params: rangeParams(range),
    }),

  shopping: (range?: ReportRangeFilter) =>
    request<ReportShopping>({
      url: '/report/shopping',
      params: rangeParams(range),
    }),

  consumption: (range?: ReportRangeFilter) =>
    request<ReportConsumption>({
      url: '/report/consumption',
      params: rangeParams(range),
    }),

  waste: (range?: ReportRangeFilter) =>
    request<ReportWaste>({
      url: '/report/waste',
      params: rangeParams(range),
    }),

  fridge: () => request<ReportFridge>({ url: '/report/fridge' }),
};
