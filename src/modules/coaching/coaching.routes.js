import { coachingController } from './coaching.controller.js';
import { automatedAttendanceController } from './automated-attendance.controller.js';
import { evaluationController } from './evaluation.controller.js';
import { siblingController } from '../students/sibling.controller.js';
import {
  listSiblingGroupsSchema,
  studentSiblingsParamSchema,
  linkSiblingsSchema,
  assignSiblingPhoneSchema,
} from '../students/sibling.schema.js';
import {
  createBatchSchema,
  updateBatchSchema,
  enrollStudentSchema,
  registerStudentSchema,
  markAttendanceSchema,
  queryBatchesSchema,
  batchParamSchema,
  batchStudentsDropdownSchema,
  batchWiseStudentsDropdownSchema,
  automatedAttendanceStatusSchema,
  automatedAttendanceLogsSchema,
} from './coaching.schema.js';
import {
  createEvaluationSchema,
  updateEvaluationSchema,
  evaluationParamSchema,
  queryEvaluationsSchema,
} from './evaluation.schema.js';
import { requireTenantContext } from '../../middleware/tenant.middleware.js';

export default async function coachingRoutes(fastify) {
  fastify.post('/coaching/batches', {
    schema: createBatchSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.createBatch.bind(coachingController),
  });

  fastify.get('/coaching/batches', {
    schema: queryBatchesSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.list.bind(coachingController),
  });

  fastify.get('/coaching/batches/:id', {
    schema: batchParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getBatchById.bind(coachingController),
  });

  // Batch-Wise Students Grouped Dropdown List
  fastify.get('/coaching/batch-wise-students', {
    schema: batchWiseStudentsDropdownSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getBatchWiseStudentsDropdown.bind(coachingController),
  });

  // Alias for batch-wise students dropdown
  fastify.get('/coaching/batches/students/dropdown', {
    schema: batchWiseStudentsDropdownSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getBatchWiseStudentsDropdown.bind(coachingController),
  });

  // Students Dropdown for a Specific Batch ID
  fastify.get('/coaching/batches/:id/students/dropdown', {
    schema: batchStudentsDropdownSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getBatchStudentsDropdown.bind(coachingController),
  });

  // Alias: Students in a Specific Batch ID
  fastify.get('/coaching/batches/:id/students', {
    schema: batchStudentsDropdownSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getBatchStudentsDropdown.bind(coachingController),
  });

  fastify.patch('/coaching/batches/:id', {
    schema: updateBatchSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.update.bind(coachingController),
  });

  fastify.delete('/coaching/batches/:id', {
    schema: batchParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.delete.bind(coachingController),
  });

  fastify.post('/coaching/enroll', {
    schema: enrollStudentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.enrollStudent.bind(coachingController),
  });

  fastify.post('/coaching/students/register', {
    schema: registerStudentSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.registerStudent.bind(coachingController),
  });

  fastify.post('/coaching/register-student', {
    schema: { hide: true },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.registerStudent.bind(coachingController),
  });

  fastify.post('/coaching/students/:id/face', {
    schema: {
      description: '[Roles: tenant_admin, coach] Upload student face image and sync to biometric ISAPI terminal',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.uploadFace.bind(coachingController),
  });

  // --- Sibling Family Records & CRUD Operations (Coaching API Aliases) ---
  fastify.get('/coaching/siblings', {
    schema: listSiblingGroupsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.listSiblingGroups.bind(siblingController),
  });

  fastify.post('/coaching/siblings', {
    schema: linkSiblingsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.linkSiblings.bind(siblingController),
  });

  fastify.get('/coaching/students/:id/siblings', {
    schema: studentSiblingsParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.getStudentSiblings.bind(siblingController),
  });

  fastify.patch('/coaching/students/:id/sibling-phone', {
    schema: assignSiblingPhoneSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.assignSiblingPhone.bind(siblingController),
  });

  fastify.delete('/coaching/students/:id/siblings', {
    schema: studentSiblingsParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: siblingController.unlinkSibling.bind(siblingController),
  });

  fastify.post('/coaching/attendance', {
    schema: markAttendanceSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.markAttendance.bind(coachingController),
  });

  fastify.get('/coaching/batches/:id/attendance', {
    schema: {
      ...batchParamSchema,
      description: '[Roles: tenant_admin, coach] Get session attendance logs for a specific batch',
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getAttendance.bind(coachingController),
  });

  fastify.get('/coaching/batches/:batchId/students/:studentId/summary', {
    schema: {
      description: '[Roles: tenant_admin, coach, student] Get individual student coaching progress and attendance summary in a batch',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: coachingController.getStudentSummary.bind(coachingController),
  });

  // --- Coach Performance Assessments & Evaluations ---
  fastify.get('/coaching/evaluations/template', {
    schema: {
      description: 'Get dynamic assessment scorecard template with all 4 categories, 24 metrics, definitions, and max scores',
      tags: ['Coaching & Evaluations'],
    },
    preHandler: [fastify.authenticateOptional],
    handler: evaluationController.getTemplate.bind(evaluationController),
  });

  fastify.post('/coaching/evaluations', {
    schema: createEvaluationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.createEvaluation.bind(evaluationController),
  });

  fastify.get('/coaching/evaluations', {
    schema: queryEvaluationsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.listEvaluations.bind(evaluationController),
  });

  fastify.get('/coaching/evaluations/:id', {
    schema: evaluationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getEvaluationById.bind(evaluationController),
  });

  fastify.patch('/coaching/evaluations/:id', {
    schema: updateEvaluationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.updateEvaluation.bind(evaluationController),
  });

  fastify.delete('/coaching/evaluations/:id', {
    schema: evaluationParamSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.deleteEvaluation.bind(evaluationController),
  });

  fastify.get('/coaching/students/:id/evaluations', {
    schema: {
      ...batchParamSchema,
      description: '[Roles: tenant_admin, coach, student] Get student performance scorecard history and trends',
      tags: ['Coaching & Evaluations'],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.getStudentEvaluations.bind(evaluationController),
  });

  fastify.post('/coaching/students/:id/evaluations', {
    schema: createEvaluationSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: evaluationController.createEvaluation.bind(evaluationController),
  });

  // --- Automated Biometric Attendance (Hikvision ACS ISAPI) ---
  fastify.get('/attendance/automated/status', {
    schema: automatedAttendanceStatusSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.getStatus.bind(automatedAttendanceController),
  });

  const syncRouteConfig = {
    schema: {
      description: '[Roles: tenant_admin, coach] Trigger manual biometric synchronization for attendance punches',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.syncAttendance.bind(automatedAttendanceController),
  };
  fastify.get('/attendance/automated/sync', syncRouteConfig);
  fastify.post('/attendance/automated/sync', syncRouteConfig);

  fastify.post('/attendance/automated/push-roster', {
    schema: {
      description: '[Roles: tenant_admin] Push full active student roster to all biometric access terminals',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.pushRoster.bind(automatedAttendanceController),
  });

  fastify.post('/attendance/automated/simulate', {
    schema: {
      description: '[Roles: tenant_admin, developer] Simulate an attendance punch event from biometric terminal',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.simulatePunch.bind(automatedAttendanceController),
  });

  fastify.get('/attendance/automated/logs', {
    schema: automatedAttendanceLogsSchema,
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.getLogs.bind(automatedAttendanceController),
  });

  fastify.get('/attendance/automated/raw-logs', {
    schema: {
      description: 'Get recent raw transmission logs received from Hikvision terminals',
      tags: ['Coaching & Batches'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50, minimum: 1, maximum: 200 },
        },
      },
    },
    handler: automatedAttendanceController.getRawLogs.bind(automatedAttendanceController),
  });

  // Webhook for Hikvision Terminal HTTP host notifications (GET for handshake test, POST for events)
  // Supports multi-company/multi-branch URL routing:
  // 1. Global: /api/v1/attendance/automated/webhook
  // 2. Multi-company: /api/v1/attendance/automated/webhook/:tenantId (e.g. /inertia)
  // 3. Multi-branch: /api/v1/attendance/automated/webhook/:tenantId/:branchId
  // 4. Per-Sport: /api/v1/attendance/automated/webhook/:tenantId/sports/:sportSlug
  // 5. Per-Device: /api/v1/attendance/automated/webhook/:tenantId/devices/:deviceCode
  // 6. Flexible param: /api/v1/attendance/automated/webhook/:tenantId/:branchOrSportOrDevice
  // 7. Full hierarchy: /api/v1/attendance/automated/webhook/:tenantId/:branchId/:sportOrDevice
  const webhookPaths = [
    '/attendance/automated/webhook',
    '/attendance/automated/webhook/:tenantId',
    '/attendance/automated/webhook/:tenantId/sports/:sportSlug',
    '/attendance/automated/webhook/:tenantId/devices/:deviceCode',
    '/attendance/automated/webhook/:tenantId/:branchOrSportOrDevice',
    '/attendance/automated/webhook/:tenantId/:branchId/:sportOrDevice',
    '/hikvision',
    '/hikvision/:tenantId',
    '/hikvision/:tenantId/:branchOrSportOrDevice',
  ];

  for (const path of webhookPaths) {
    fastify.get(path, {
      schema: {
        description: 'Hikvision biometric terminal HTTP host GET handshake / ping test',
        tags: ['Coaching & Batches'],
      },
      handler: async (request, reply) => {
        const clientIp = request.ip || request.socket?.remoteAddress;
        console.log(`\n🤝 [HIKVISION HANDSHAKE] Device ping / connection test received`);
        console.log(`   URL: ${request.url}`);
        console.log(`   From IP: ${clientIp}`);
        console.log(`   Status: Responding 200 OK to device`);
        return reply.code(200).send('OK');
      },
    });

    fastify.post(path, {
      schema: {
        description: 'Hikvision biometric terminal HTTP host event webhook receiver',
        tags: ['Coaching & Batches'],
      },
      onRequest: (request, reply, done) => {
        // Strip strict content-length so Fastify does not abort on embedded firmware CRLF mismatch
        delete request.headers['content-length'];
        done();
      },
      handler: automatedAttendanceController.handleWebhook.bind(automatedAttendanceController),
    });
  }

  fastify.post('/attendance/automated/configure-webhook', {
    schema: {
      description: '[Roles: tenant_admin] Configure automated attendance webhook URL on remote Hikvision terminal',
      tags: ['Coaching & Batches'],
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, requireTenantContext],
    handler: automatedAttendanceController.configureWebhook.bind(automatedAttendanceController),
  });
}

