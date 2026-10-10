// ข้อมูลผู้รับเงินแบบ "พิมพ์เองได้" บนหน้าจ่ายเงิน
// ที่มา: ลูกค้าทักเข้ามาซ้ำ ๆ ว่าจ่ายไม่ได้ — "เวลาจะจ่ายด้วย QR code มันจะขึ้นว่าให้จ่ายด้วย K point"
// เดิมหน้าจ่ายเงินมีทางเดียวคือสแกน QR → ต้องมีเลขพร้อมเพย์ให้โอนเองได้ด้วย
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const generatePayload = require('promptpay-qr');

const ENV = ['PROMPTPAY_ID', 'PROMPTPAY_QR_PAYLOAD', 'PROMPTPAY_NAME'];
const path = require.resolve('../src/services/promptpayService');

// service อ่าน env ตอนเรียกฟังก์ชัน แต่ราคาอ่านตอน require → โหลดใหม่ทุกครั้งให้ชัวร์
function load(env) {
  for (const k of ENV) delete process.env[k];
  Object.assign(process.env, env);
  delete require.cache[path];
  return require(path);
}

beforeEach(() => { for (const k of ENV) delete process.env[k]; });

describe('เลขพร้อมเพย์สำหรับโอนเอง', () => {
  test('ตั้ง PROMPTPAY_ID เป็นเบอร์ → คืนรูปแบบที่พิมพ์ตามได้', () => {
    const pp = load({ PROMPTPAY_ID: '0812345678', PROMPTPAY_NAME: 'ปรินนี่ ส.' });
    assert.deepEqual(pp.recipient(), { target: '081-234-5678', name: 'ปรินนี่ ส.' });
  });

  test('ใช้ QR ร้านค้า static → ถอดเบอร์ออกมาจาก payload ได้', () => {
    const pp = load({ PROMPTPAY_QR_PAYLOAD: generatePayload('0898887777', {}) });
    assert.equal(pp.recipient().target, '089-888-7777');
  });

  test('QR ร้านค้าที่ผูกเลขบัตรประชาชน → จัดรูปแบบ 13 หลักให้อ่านง่าย', () => {
    const pp = load({ PROMPTPAY_QR_PAYLOAD: generatePayload('1234567890123', {}) });
    assert.equal(pp.recipient().target, '1-2345-67890-12-3');
  });

  test('ยังไม่ตั้งค่าอะไรเลย → ไม่มีเลขให้ (หน้าเว็บซ่อนบล็อกนี้)', () => {
    const pp = load({});
    assert.equal(pp.recipient().target, null);
  });

  test('ไม่ตั้งชื่อบัญชี → คืน null ไม่ใช่ค่าว่าง (หน้าเว็บใช้เช็คว่าจะโชว์บรรทัดชื่อไหม)', () => {
    const pp = load({ PROMPTPAY_ID: '0812345678' });
    assert.equal(pp.recipient().name, null);
  });

  test('เลขที่ถอดได้ต้องเป็นเบอร์เดียวกับที่ฝังอยู่ใน QR จริง (ไม่ให้ลูกค้าโอนผิดบัญชี)', () => {
    const pp = load({ PROMPTPAY_ID: '0812345678' });
    const digits = pp.recipient().target.replace(/\D/g, '');
    assert.ok(pp.payload(399).includes('0066' + digits.slice(1)),
      'เลขที่โชว์ให้โอนเอง ต้องตรงกับปลายทางใน QR');
  });
});

// 10 ต.ค. 69: ลูกค้าสแกน QR ร้าน K Shop ไม่ผ่านหลายคน ขอเลขบัญชี แต่ QR แบบจ่ายบิลไม่มีเบอร์พร้อมเพย์ให้ถอด
// → เพิ่มบัญชีธนาคารโอนเอง + สวิตช์ส่ง QR ไม่ฝังยอด
describe('บัญชีธนาคารโอนเอง + QR ไม่ฝังยอด', () => {
  const BANK = ['BANK_ACCOUNT_NO', 'BANK_NAME', 'BANK_ACCOUNT_NAME', 'PROMPTPAY_QR_NO_AMOUNT'];
  beforeEach(() => { for (const k of BANK) delete process.env[k]; });

  test('ตั้งเลขบัญชี 10 หลัก → จัดรูปแบบกสิกร xxx-x-xxxxx-x พร้อมธนาคารและชื่อ', () => {
    const pp = load({ BANK_ACCOUNT_NO: '0738644158', BANK_NAME: 'กสิกรไทย', BANK_ACCOUNT_NAME: 'แอสโทรลิงค์' });
    assert.deepEqual(pp.bankAccount(), { no: '073-8-64415-8', bank: 'กสิกรไทย', name: 'แอสโทรลิงค์' });
  });

  test('ไม่ตั้งเลขบัญชี → null (หน้าเว็บซ่อนแถวนี้)', () => {
    assert.equal(load({}).bankAccount(), null);
  });

  test('QR ร้านค้าปกติฝังยอด (tag01=12, tag54) · เปิด PROMPTPAY_QR_NO_AMOUNT → ส่งต้นฉบับไม่แก้', () => {
    const raw = generatePayload('0898887777', {});
    let pp = load({ PROMPTPAY_QR_PAYLOAD: raw });
    assert.equal(pp.amountEmbedded(), true);
    assert.ok(pp.payload(399).includes('5406399.00'));
    pp = load({ PROMPTPAY_QR_PAYLOAD: raw, PROMPTPAY_QR_NO_AMOUNT: 'true' });
    assert.equal(pp.amountEmbedded(), false);
    assert.equal(pp.payload(399), raw);
  });

  test('เตือนออเดอร์ค้าง มีเลขบัญชีโอนเองเมื่อตั้งค่าไว้', () => {
    load({ BANK_ACCOUNT_NO: '0738644158', BANK_NAME: 'กสิกรไทย', BANK_ACCOUNT_NAME: 'แอสโทรลิงค์' });
    const sh = require('../src/services/slipHelp');
    const t = sh.reminderText({ name: 'ส้ม', order: { type: 'subscription' }, payUrl: 'https://x/pay.html?ref=a' });
    assert.match(t, /กสิกรไทย 073-8-64415-8 ชื่อบัญชี แอสโทรลิงค์/);
    delete process.env.BANK_ACCOUNT_NO;
    assert.doesNotMatch(sh.reminderText({ order: { type: 'subscription' }, payUrl: 'u' }), /เลขบัญชี|บัญชี /);
  });
});
