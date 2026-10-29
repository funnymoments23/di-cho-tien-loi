const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Chỉ thay hàm gửi push; phần dựng nội dung message vẫn dùng code thật.
jest.mock('../src/utils/pushNotification', () => {
  const actual = jest.requireActual('../src/utils/pushNotification');
  return { ...actual, sendExpoPush: jest.fn() };
});

const {
  runExpiryCheck,
  buildExpiryWindow,
  notifyDays,
} = require('../src/jobs/expiryChecker.job');
const { sendExpoPush } = require('../src/utils/pushNotification');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Food = require('../src/models/food.models');
const FridgeItem = require('../src/models/fridgeItem.models');

const NOW = new Date('2026-10-29T01:00:00.000Z');
const day = (offset) => new Date(Date.UTC(2026, 9, 29 + offset));

let mongod;
let sequence = 0;

const createUser = async ({ groupId = null, deviceToken = null } = {}) => {
  const id = ++sequence;
  return User.create({
    email: `expiry${id}@example.com`,
    password: 'hash',
    name: `Người dùng ${id}`,
    username: `expiryuser${id}`,
    groupId,
    deviceToken,
  });
};

/** Tạo nhóm với danh sách deviceToken; thành viên đầu tiên là trưởng nhóm. */
const createGroup = async ({ name, tokens = [] }) => {
  const admin = await createUser({ deviceToken: tokens[0] || null });
  const group = await Group.create({
    name,
    adminId: admin._id,
    members: [admin._id],
  });
  admin.groupId = group._id;
  await admin.save();

  for (const token of tokens.slice(1)) {
    const member = await createUser({ groupId: group._id, deviceToken: token });
    group.members.push(member._id);
  }
  if (tokens.length > 1) await group.save();

  return group;
};

const createItem = async (groupId, { name, expiryDate, isNotified = false }) => {
  const food = await Food.create({
    name: `${name} ${++sequence}`,
    categoryId: new mongoose.Types.ObjectId(),
    unitId: new mongoose.Types.ObjectId(),
    groupId,
  });

  return FridgeItem.create({
    foodId: food._id,
    groupId,
    quantity: 1,
    expiryDate,
    isNotified,
  });
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Food.deleteMany({}),
    FridgeItem.deleteMany({}),
  ]);
  sendExpoPush.mockReset();
  sendExpoPush.mockResolvedValue({ sent: 1, failed: 0, tickets: [], errors: [] });
});

describe('buildExpiryWindow', () => {
  it('lấy từ đầu ngày hôm nay tới hết ngày thứ N (mốc UTC)', () => {
    const { start, end } = buildExpiryWindow(NOW, 3);

    expect(start.toISOString()).toBe('2026-10-29T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T23:59:59.999Z');
  });

  it('đọc số ngày từ EXPIRY_NOTIFY_DAYS, sai giá trị thì dùng mặc định 3', () => {
    const original = process.env.EXPIRY_NOTIFY_DAYS;

    process.env.EXPIRY_NOTIFY_DAYS = '5';
    expect(notifyDays()).toBe(5);

    process.env.EXPIRY_NOTIFY_DAYS = 'không-phải-số';
    expect(notifyDays()).toBe(3);

    process.env.EXPIRY_NOTIFY_DAYS = '';
    expect(notifyDays()).toBe(3);

    if (original === undefined) delete process.env.EXPIRY_NOTIFY_DAYS;
    else process.env.EXPIRY_NOTIFY_DAYS = original;
  });
});

describe('runExpiryCheck', () => {
  it('chỉ quét mục chưa nhắc, còn hạn trong 3 ngày và đánh dấu sau khi gửi', async () => {
    const group = await createGroup({
      name: 'Gia đình A',
      tokens: ['ExponentPushToken[token-a]'],
    });

    const today = await createItem(group._id, { name: 'Sữa', expiryDate: day(0) });
    const lastDay = await createItem(group._id, { name: 'Cà chua', expiryDate: day(3) });
    const tooFar = await createItem(group._id, { name: 'Thịt', expiryDate: day(4) });
    const expired = await createItem(group._id, { name: 'Trứng', expiryDate: day(-1) });
    const alreadyNotified = await createItem(group._id, {
      name: 'Bơ',
      expiryDate: day(1),
      isNotified: true,
    });

    const summary = await runExpiryCheck({ now: NOW });

    expect(summary).toMatchObject({
      scanned: 2,
      groups: 1,
      notificationsSent: 1,
      itemsMarked: 2,
      groupsSkippedNoToken: 0,
      itemsFailed: 0,
    });
    expect(sendExpoPush).toHaveBeenCalledTimes(1);

    const messages = sendExpoPush.mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain('2 thực phẩm sắp hết hạn');

    const refreshed = await FridgeItem.find({ _id: { $in: [today, lastDay, tooFar, expired, alreadyNotified].map((item) => item._id) } });
    const byId = new Map(refreshed.map((item) => [String(item._id), item]));
    expect(byId.get(String(today._id)).isNotified).toBe(true);
    expect(byId.get(String(lastDay._id)).isNotified).toBe(true);
    expect(byId.get(String(tooFar._id)).isNotified).toBe(false);
    expect(byId.get(String(expired._id)).isNotified).toBe(false);
    expect(byId.get(String(alreadyNotified._id)).isNotified).toBe(true);
  });

  it('gộp theo nhóm, chỉ gửi tới thành viên có token và bỏ qua nhóm chưa có token', async () => {
    const groupA = await createGroup({
      name: 'Gia đình A',
      tokens: ['ExponentPushToken[token-a1]', 'ExponentPushToken[token-a2]'],
    });
    const groupB = await createGroup({ name: 'Gia đình B', tokens: [] });

    const itemA = await createItem(groupA._id, { name: 'Sữa', expiryDate: day(1) });
    const itemB = await createItem(groupB._id, { name: 'Cà chua', expiryDate: day(2) });

    sendExpoPush.mockImplementation(async (messages) => ({
      sent: messages.length,
      failed: 0,
      tickets: [],
      errors: [],
    }));

    const summary = await runExpiryCheck({ now: NOW });

    expect(summary).toMatchObject({
      scanned: 2,
      groups: 2,
      notificationsSent: 2,
      itemsMarked: 1,
      groupsSkippedNoToken: 1,
      itemsFailed: 0,
    });
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
    expect(sendExpoPush.mock.calls[0][0].map((message) => message.to)).toEqual([
      'ExponentPushToken[token-a1]',
      'ExponentPushToken[token-a2]',
    ]);

    expect((await FridgeItem.findById(itemA._id)).isNotified).toBe(true);
    expect((await FridgeItem.findById(itemB._id)).isNotified).toBe(false);
  });

  it('nhóm không có deviceToken thì không gửi và không đánh dấu', async () => {
    const group = await createGroup({ name: 'Gia đình A', tokens: [] });
    const item = await createItem(group._id, { name: 'Sữa', expiryDate: day(1) });

    const summary = await runExpiryCheck({ now: NOW });

    expect(sendExpoPush).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 1, groupsSkippedNoToken: 1, itemsMarked: 0 });
    expect((await FridgeItem.findById(item._id)).isNotified).toBe(false);
  });

  it('gửi thất bại thì giữ isNotified = false để lần sau thử lại', async () => {
    const group = await createGroup({
      name: 'Gia đình A',
      tokens: ['ExponentPushToken[token-a]'],
    });
    const item = await createItem(group._id, { name: 'Sữa', expiryDate: day(1) });

    sendExpoPush.mockResolvedValue({
      sent: 0,
      failed: 1,
      tickets: [],
      errors: [{ token: 'ExponentPushToken[token-a]', message: 'DeviceNotRegistered' }],
    });

    const summary = await runExpiryCheck({ now: NOW });

    expect(summary).toMatchObject({ itemsFailed: 1, itemsMarked: 0 });
    expect(summary.errors).toHaveLength(1);
    expect((await FridgeItem.findById(item._id)).isNotified).toBe(false);
  });

  it('chạy lần hai không gửi lại mục đã nhắc', async () => {
    const group = await createGroup({
      name: 'Gia đình A',
      tokens: ['ExponentPushToken[token-a]'],
    });
    await createItem(group._id, { name: 'Sữa', expiryDate: day(1) });

    await runExpiryCheck({ now: NOW });
    const second = await runExpiryCheck({ now: NOW });

    expect(sendExpoPush).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ scanned: 0, notificationsSent: 0, itemsMarked: 0 });
  });

  it('không có mục nào cần nhắc thì không gọi Expo', async () => {
    const summary = await runExpiryCheck({ now: NOW });

    expect(summary.scanned).toBe(0);
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});
