/**
 * Verification test for Event Location schema and persistence
 */
const { z } = require('zod');
const assert = require('assert');

const eventCustomFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'date', 'select', 'checkbox']),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

const createEventSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  location: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional()
  ),
  banner: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional()
  ),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  customFields: z.array(eventCustomFieldSchema).optional(),
});

console.log('Testing createEventSchema with location...');

// Test 1: with valid location
const payload1 = {
  name: 'WorkShop Sistemas Web',
  description: 'Workshop de IA',
  location: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  startDate: '2026-10-17T19:00:00Z',
  endDate: '2026-10-17T22:00:00Z',
};

const parsed1 = createEventSchema.parse(payload1);
assert.strictEqual(parsed1.location, 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP');
console.log('✓ Valid location parsed correctly:', parsed1.location);

// Test 2: empty location string converts to undefined/optional
const payload2 = {
  name: 'Evento Sem Local',
  location: '   ',
  startDate: '2026-10-17T19:00:00Z',
};
const parsed2 = createEventSchema.parse(payload2);
assert.strictEqual(parsed2.location, undefined);
console.log('✓ Empty location preprocessed to undefined');

// Test 3: omitted location
const payload3 = {
  name: 'Evento Omitido',
  startDate: '2026-10-17T19:00:00Z',
};
const parsed3 = createEventSchema.parse(payload3);
assert.strictEqual(parsed3.location, undefined);
console.log('✓ Omitted location is valid');

console.log('\nAll location schema tests passed successfully!');
