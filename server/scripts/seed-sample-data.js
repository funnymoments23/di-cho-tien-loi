require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/database');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Food = require('../src/models/food.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const SAMPLE_PASSWORD = 'Matkhau@123';

const SAMPLE_USERS = [
  {
    email: 'an.nguyen@example.com',
    name: 'Nguyễn Văn An',
    username: 'annguyen',
    gender: 'male',
    birthday: new Date('1996-03-12'),
    language: 'vi',
  },
  {
    email: 'binh.tran@example.com',
    name: 'Trần Thị Bình',
    username: 'binhtran',
    gender: 'female',
    birthday: new Date('1998-07-25'),
    language: 'vi',
  },
];

(async () => {
  try {
    await connectDB();
    console.log(`Database đang dùng: ${mongoose.connection.db.databaseName}`);

    // 1) Users (upsert theo email, không tạo trùng khi chạy lại)
    const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, BCRYPT_ROUNDS);
    const users = [];
    for (const u of SAMPLE_USERS) {
      const user = await User.findOneAndUpdate(
        { email: u.email },
        { $set: { ...u, password: passwordHash, isVerified: true, role: 'user' } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      users.push(user);
    }
    const [admin, member] = users;
    console.log('✓ Users:', users.map((u) => `${u.name} <${u.email}>`).join(' | '));

    // 2) Group — admin là user 1, thành viên gồm cả 2 user
    const group = await Group.findOneAndUpdate(
      { name: 'Gia đình An - Bình' },
      {
        $set: {
          name: 'Gia đình An - Bình',
          adminId: admin._id,
          members: [admin._id, member._id],
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    await User.updateMany(
      { _id: { $in: [admin._id, member._id] } },
      { $set: { groupId: group._id } }
    );
    console.log(`✓ Group: ${group.name} (admin: ${admin.name}, ${group.members.length} thành viên)`);

    // 3) Category + Unit: Food bắt buộc phải có, nên dùng lại nếu DB đã có
    let category = await Category.findOne({ name: 'Thịt' });
    if (!category) category = await Category.create({ name: 'Thịt' });
    let unit = await Unit.findOne({ name: 'kg' });
    if (!unit) unit = await Unit.create({ name: 'kg' });
    console.log(`✓ Category/Unit: ${category.name} / ${unit.name}`);

    // 4) Foods trong nhóm (unique theo groupId + name)
    const SAMPLE_FOODS = [
      { name: 'Thịt bò', image: null },
      { name: 'Ức gà', image: null },
    ];
    for (const f of SAMPLE_FOODS) {
      const food = await Food.findOneAndUpdate(
        { groupId: group._id, name: f.name },
        {
          $set: {
            name: f.name,
            image: f.image,
            categoryId: category._id,
            unitId: unit._id,
            groupId: group._id,
            createdBy: admin._id,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      console.log(`✓ Food: ${food.name} (_id: ${food._id})`);
    }

    console.log('\n=== HOÀN TẤT ===');
    console.log(`Mật khẩu chung cho cả 2 user: ${SAMPLE_PASSWORD}`);
    console.log(`_id user 1: ${admin._id}`);
    console.log(`_id user 2: ${member._id}`);
    console.log(`_id group : ${group._id}`);
    process.exit(0);
  } catch (err) {
    console.error('SEED THẤT BẠI:', err.message);
    process.exit(1);
  }
})();
