import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeIndexPayload, leadDedupeIdentity } from '../api/_leadDedupe.ts';
import { salesImportAssignmentTargetsSelf, salesImportExistingLeadAccess } from '../api/_leadImportPolicy.ts';

test('cùng SĐT và cùng tên học sinh tạo cùng dedupe index', () => {
  const first = leadDedupeIdentity('+84 971 000 001', 'Bé Ánh');
  const second = leadDedupeIdentity('0971.000.001', '  be   anh ');
  assert.equal(first?.indexId, second?.indexId);
});

test('cùng SĐT nhưng khác tên học sinh tạo dedupe index khác', () => {
  const first = leadDedupeIdentity('0971000001', 'Bé Ánh');
  const second = leadDedupeIdentity('0971000001', 'Bé An');
  assert.notEqual(first?.indexId, second?.indexId);
});

test('thiếu tên học sinh không tạo dedupe index', () => {
  assert.equal(leadDedupeIdentity('0971000001', ''), null);
  assert.equal(dedupeIndexPayload({ id: 'lead-1', phone: '0971000001', parentName: 'Chị Mai' }, new Date().toISOString()), null);
});

test('sales chỉ được ghi assignment của chính mình', () => {
  const sales = { id: 'sales-1', fullName: 'Nguyễn Văn An', email: 'an@example.com' };
  assert.equal(salesImportAssignmentTargetsSelf(sales, 'sales-1', 'Nguyễn Văn An'), true);
  assert.equal(salesImportAssignmentTargetsSelf(sales, 'sales-2', ''), false);
});

test('sales được update lead của mình, claim unassigned và bị chặn với lead người khác', () => {
  const sales = { id: 'sales-1', fullName: 'Nguyễn Văn An' };
  assert.equal(salesImportExistingLeadAccess(sales, 'sales-1', 'Nguyễn Văn An'), 'own');
  assert.equal(salesImportExistingLeadAccess(sales, '', ''), 'claim');
  assert.equal(salesImportExistingLeadAccess(sales, 'sales-2', 'Sales Khác'), 'forbidden');
  assert.equal(salesImportExistingLeadAccess(sales, 'sales-2', 'Nguyễn Văn An'), 'forbidden');
});
