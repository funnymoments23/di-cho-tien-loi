const mongoose = require('mongoose');
const os = require('os');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/user.models');
const { seedAdmin, readConfig } = require('../scripts/seed-admin');

let mongod;
let counter = 0;

const createUser = async (overrides = {}) => {
  const id = ++counter;
  return User.create({
    email: `seed${id}@example.com`,
    password: await bcrypt.hash('matkhau123', 4),
    name: 'Người dùng cũ',
    username: `seeduser${id}`,
    isVerified: true,
    ...overrides,
  });
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  // Cô lập test khỏi .env thật: chỉ dùng override truyền vào.
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_NAME;
  delete process.env.ADMIN_USERNAME;
});

describe('seedAdmin', () => {
  it('tạo tài khoản admin mới với mật khẩu băm, đã xác minh và đang hoạt động', async () => {
    const result = await seedAdmin({
      email: 'admin@example.com',
      password: 'Matkhau@123',
      name: 'Quản trị viên',
      username: 'adminroot',
    });

    expect(result.created).toBe(true);
    expect(result.user).toMatchObject({
      email: 'admin@example.com',
      name: 'Quản trị viên',
      username: 'adminroot',
      role: 'admin',
      isVerified: true,
      isActive: true,
    });
    expect(result.user.password).not.toBe('Matkhau@123');
    expect(await bcrypt.compare('Matkhau@123', result.user.password)).toBe(true);
  });

  it('dùng username mặc định "admin" khi không truyền', async () => {
    const result = await seedAdmin({
      email: 'admin2@example.com',
      password: 'Matkhau@123',
    });

    expect(result.user.username).toBe('admin');
    expect(result.user.role).toBe('admin');
  });

  it('nâng quyền tài khoản đã tồn tại, giữ username/groupId và đổi mật khẩu', async () => {
    const groupId = new mongoose.Types.ObjectId();
    const existing = await createUser({
      email: 'promote@example.com',
      username: 'nguoidungcu',
      groupId,
      isVerified: false,
      isActive: false,
      lockedAt: new Date(),
    });

    const result = await seedAdmin({
      email: 'promote@example.com',
      password: 'Matkhaumoi123',
      name: 'Tên mới',
    });

    expect(result.created).toBe(false);
    expect(result.user._id.toString()).toBe(existing._id.toString());
    expect(result.user).toMatchObject({
      role: 'admin',
      name: 'Tên mới',
      username: 'nguoidungcu',
      isVerified: true,
      isActive: true,
      lockedAt: null,
    });
    expect(String(result.user.groupId)).toBe(String(groupId));
    expect(await bcrypt.compare('Matkhaumoi123', result.user.password)).toBe(true);
  });

  it('cập nhật username khi có truyền ADMIN_USERNAME', async () => {
    await createUser({ email: 'rename@example.com', username: 'tencu' });

    const result = await seedAdmin({
      email: 'rename@example.com',
      password: 'Matkhau@123',
      username: 'tenmoi123',
    });

    expect(result.user.username).toBe('tenmoi123');
    expect(result.user.role).toBe('admin');
  });

  it('chạy lại cùng email không tạo trùng tài khoản', async () => {
    await seedAdmin({ email: 'again@example.com', password: 'Matkhau@123' });
    await seedAdmin({ email: 'again@example.com', password: 'Matkhaumoi123' });

    expect(await User.countDocuments({ email: 'again@example.com' })).toBe(1);
  });

  it('báo lỗi khi username đã thuộc tài khoản khác và không tạo admin mới', async () => {
    await createUser({ username: 'dabaotri' });

    await expect(
      seedAdmin({
        email: 'newadmin@example.com',
        password: 'Matkhau@123',
        username: 'dabaotri',
      })
    ).rejects.toThrow(/đã thuộc về tài khoản khác/);

    expect(await User.countDocuments({ email: 'newadmin@example.com' })).toBe(0);
  });
});

describe('readConfig', () => {
  it('báo lỗi khi thiếu email, sai email hoặc mật khẩu không hợp lệ', () => {
    expect(() => readConfig({ email: '', password: 'Matkhau@123' })).toThrow(/ADMIN_EMAIL/);
    expect(() => readConfig({ email: 'sai-email', password: 'Matkhau@123' })).toThrow(
      /ADMIN_EMAIL không hợp lệ/
    );
    expect(() => readConfig({ email: 'a@example.com', password: '' })).toThrow(/ADMIN_PASSWORD/);
    expect(() => readConfig({ email: 'a@example.com', password: '123' })).toThrow(
      /6 đến 20 ký tự/
    );
  });

  it('báo lỗi khi tên hoặc username sai độ dài', () => {
    expect(() =>
      readConfig({ email: 'a@example.com', password: 'Matkhau@123', name: 'A' })
    ).toThrow(/ADMIN_NAME/);
    expect(() =>
      readConfig({
        email: 'a@example.com',
        password: 'Matkhau@123',
        username: 'ab',
      })
    ).toThrow(/ADMIN_USERNAME/);
  });

  it('chuẩn hoá email về chữ thường và trim tên/username', () => {
    const config = readConfig({
      email: '  ADMIN@Example.COM ',
      password: 'Matkhau@123',
      name: '  Quản trị  ',
      username: '  adminroot  ',
    });

    expect(config).toEqual({
      email: 'admin@example.com',
      password: 'Matkhau@123',
      name: 'Quản trị',
      username: 'adminroot',
    });
  });
});
