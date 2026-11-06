import { slotController } from './slot.controller.js';
import {
  getSlotsSchema,
  holdSlotSchema,
  releaseSlotSchema,
  calculatePriceSchema,
} from './slot.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function slotRoutes(fastify) {
  // 1. Slot Availability Grid (supports /slots and /slots/grid)
  fastify.get('/slots', {
    schema: getSlotsSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.getSlots.bind(slotController),
  });

  fastify.get('/slots/grid', {
    schema: getSlotsSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.getSlots.bind(slotController),
  });

  // 2. Slot Lock / Hold (Single or Multi-Slot)
  fastify.post('/slots/hold', {
    schema: holdSlotSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.holdSlot.bind(slotController),
  });

  fastify.post('/slots/multi-hold', {
    schema: holdSlotSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.holdSlot.bind(slotController),
  });

  // 3. Slot Release (Single or Multi-Slot)
  fastify.post('/slots/release', {
    schema: releaseSlotSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.releaseSlot.bind(slotController),
  });

  fastify.post('/slots/multi-release', {
    schema: releaseSlotSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.releaseSlot.bind(slotController),
  });

  // 4. Calculate Price / Quote (supports /slots/calculate-price, /slots/quote, /slots/price)
  fastify.post('/slots/calculate-price', {
    schema: calculatePriceSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.calculatePrice.bind(slotController),
  });

  fastify.post('/slots/quote', {
    schema: calculatePriceSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.calculatePrice.bind(slotController),
  });

  fastify.post('/slots/price', {
    schema: calculatePriceSchema,
    preHandler: [fastify.authenticateOptional],
    handler: slotController.calculatePrice.bind(slotController),
  });
}
