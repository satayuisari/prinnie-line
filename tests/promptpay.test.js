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
