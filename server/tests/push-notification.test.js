const {
  buildExpiryMessages,
  daysUntilExpiry,
  describeDays,
  isValidExpoPushToken,
  sendExpoPush,
  MAX_MESSAGES_PER_REQUEST,
} = require('../src/utils/pushNotification');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('isValidExpoPushToken', () => {
  it('chấp nhận token Expo hợp lệ và từ chối chuỗi khác', () => {
    expect(isValidExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isValidExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isValidExpoPushToken('  ExponentPushToken[abc123]  ')).toBe(true);
    expect(isValidExpoPushToken('abc123')).toBe(false);
    expect(isValidExpoPushToken('')).toBe(false);
    expect(isValidExpoPushToken(null)).toBe(false);
  });
});

describe('daysUntilExpiry / describeDays', () => {
  const now = new Date('2026-10-29T01:00:00.000Z');

  it('tính theo ngày, không theo giờ', () => {
    expect(daysUntilExpiry(new Date('2026-10-29T00:00:00.000Z'), now)).toBe(0);
    expect(daysUntilExpiry(new Date('2026-10-30T00:00:00.000Z'), now)).toBe(1);
    expect(daysUntilExpiry(new Date('2026-11-01T00:00:00.000Z'), now)).toBe(3);
    // Hạn cuối ngày vẫn tính là cùng ngày, không thành 4.
    expect(daysUntilExpiry(new Date('2026-11-01T23:59:59.999Z'), now)).toBe(3);
  });

  it('mục đã quá hạn vẫn trả 0 để thông báo không âm ngày', () => {
    expect(daysUntilExpiry(new Date('2026-10-27T00:00:00.000Z'), now)).toBe(0);
    expect(describeDays(0)).toBe('hôm nay');
    expect(describeDays(1)).toBe('sau 1 ngày');
    expect(describeDays(3)).toBe('sau 3 ngày');
  });
});

describe('buildExpiryMessages', () => {
  const now = new Date('2026-10-29T01:00:00.000Z');

  it('một món: nội dung nêu tên và số ngày còn lại', () => {
    const messages = buildExpiryMessages({
      groupId: 'group-1',
      tokens: ['ExponentPushToken[token-1]'],
      now,
      items: [
        {
          _id: 'item-1',
          foodId: { name: 'Sữa tươi' },
          expiryDate: new Date('2026-10-31T00:00:00.000Z'),
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: 'ExponentPushToken[token-1]',
      title: 'Thực phẩm sắp hết hạn',
      body: 'Sữa tươi sẽ hết hạn sau 2 ngày!',
      data: {
        type: 'EXPIRY_REMINDER',
        groupId: 'group-1',
        itemIds: ['item-1'],
        daysUntilExpiry: 2,
      },
    });
  });

  it('nhiều món: tóm tắt danh sách, loại token trùng và token không hợp lệ', () => {
    const messages = buildExpiryMessages({
      groupId: 'group-1',
      tokens: [
        'ExponentPushToken[token-1]',
        'ExponentPushToken[token-1]',
        'token-sai',
        null,
        'ExpoPushToken[token-2]',
      ],
      now,
      items: [
        { _id: '1', foodId: { name: 'Sữa' }, expiryDate: new Date('2026-10-29T00:00:00.000Z') },
        { _id: '2', foodId: { name: 'Cà chua' }, expiryDate: new Date('2026-10-30T00:00:00.000Z') },
      ],
    });

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.to)).toEqual([
      'ExponentPushToken[token-1]',
      'ExpoPushToken[token-2]',
    ]);
    expect(messages[0].body).toBe('2 thực phẩm sắp hết hạn: Sữa, Cà chua');
    expect(messages[0].data.itemIds).toEqual(['1', '2']);
    expect(messages[0].data.daysUntilExpiry).toBe(0);
  });

  it('không có token hợp lệ thì không tạo message', () => {
    expect(
      buildExpiryMessages({
        groupId: 'group-1',
        tokens: [],
        now,
        items: [{ _id: '1', foodId: { name: 'Sữa' }, expiryDate: now }],
      })
    ).toEqual([]);
  });
});

describe('sendExpoPush', () => {
  it('không gọi fetch khi không có message hợp lệ', async () => {
    global.fetch = jest.fn();

    const result = await sendExpoPush([{ to: 'token-sai', title: 'x' }]);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 0 });
  });

  it('gửi đúng endpoint, header và đếm ticket thành công', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    }));

    const result = await sendExpoPush([
      { to: 'ExponentPushToken[abc]', title: 'Tiêu đề', body: 'Nội dung' },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)[0].to).toBe('ExponentPushToken[abc]');
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('chia lô tối đa 100 message mỗi request', async () => {
    global.fetch = jest.fn(async (url, options) => {
      const batch = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ data: batch.map((_, index) => ({ status: 'ok', id: `t-${index}` })) }),
      };
    });

    const messages = Array.from({ length: MAX_MESSAGES_PER_REQUEST + 1 }, (_, index) => ({
      to: `ExponentPushToken[token-${index}]`,
      title: 'Tiêu đề',
      body: 'Nội dung',
    }));

    const result = await sendExpoPush(messages);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const sizes = global.fetch.mock.calls.map(([, options]) => JSON.parse(options.body).length);
    expect(sizes).toEqual([100, 1]);
    expect(result.sent).toBe(101);
  });

  it('ticket lỗi được đếm vào failed nhưng không ném lỗi', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } }],
      }),
    }));

    const result = await sendExpoPush([{ to: 'ExponentPushToken[abc]', title: 'x' }]);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toBe('DeviceNotRegistered');
  });

  it('HTTP lỗi và lỗi mạng đều trả về failed thay vì ném ra ngoài', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    }));

    const httpResult = await sendExpoPush([{ to: 'ExponentPushToken[abc]', title: 'x' }]);
    expect(httpResult.failed).toBe(1);
    expect(httpResult.errors[0].status).toBe(503);

    global.fetch = jest.fn(async () => {
      throw new Error('mất mạng');
    });

    const networkResult = await sendExpoPush([{ to: 'ExponentPushToken[abc]', title: 'x' }]);
    expect(networkResult.failed).toBe(1);
    expect(networkResult.errors[0].message).toBe('mất mạng');
  });
});
