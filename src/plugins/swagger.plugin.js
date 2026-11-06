import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Sports Academy SaaS Platform API',
        description: 'Production-grade Multi-Sports Academy Management, Booking, IoT & Access Control API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'https://www.amdplayapi.amdtechno.in',
          description: 'Production HTTPS API Server',
        },
        {
          url: 'https://amdplayapi.amdtechno.in',
          description: 'Production Direct API Server',
        },
        {
          url: `http://localhost:${process.env.PORT || 5005}`,
          description: 'Local Development Server',
        },
      ],
      tags: [
        {
          name: 'SuperAdmin Management',
          description: 'Global SaaS platform orchestration APIs for SuperAdmins: Tenant Academy Onboarding, Custom Domain Mapping, Isolated Database Strategy, System RBAC Roles, and Multi-Service Health Diagnostics [Roles: super_admin]',
        },
        {
          name: 'Admin Management',
          description: 'Academy operational administration APIs for Academy Owners & Branch Managers: Academy Profile & Settings, WhatsApp Gateway, Razorpay Integration, User/Staff Management, and Custom RBAC Roles [Roles: tenant_admin, branch_manager]',
        },
        {
          name: 'Authentication',
          description: 'Dedicated login endpoints for SuperAdmin, Tenant, Trainee/Student, Member, and Instant Court Booking Checkout [Roles: All]',
        },
        {
          name: 'Students Management',
          description: 'Mobile & Web Student App APIs: Trainee Login, Single/Sibling Multi-Profile Switch, Attendance Stats, Coach Attendance Marking, Face Vector Sync & Monthly Fee Invoices [Roles: student, coach, tenant_admin, branch_manager]',
        },
        {
          name: 'Members Management & Subscriptions',
          description: 'Mobile & Web Member App APIs: Member Login, My Active Subscriptions, Membership Plans & RFID/Biometric Onboarding [Roles: member, customer, tenant_admin, branch_manager]',
        },
        {
          name: 'Bookings Management',
          description: 'Mobile Court Booking APIs: Instant Register & Book, My Bookings History, 6-Digit Gate PIN, QR Pass, Check-In & Receipts [Roles: customer, member, student, tenant_admin, branch_manager, staff]',
        },
        {
          name: 'Slots & Dynamic Pricing',
          description: 'Court Availability Grid, Real-Time Slot Search, 5-Minute Redis Atomic Holds & Multi-Tier Pricing Engine [Roles: All]',
        },
        {
          name: 'Sports & Resources Management',
          description: 'Sports Master Catalog, Courts, Turfs, Pitches, Lighting/Relay Controls & Hourly Pricing [Roles: tenant_admin, branch_manager, All]',
        },
        {
          name: 'Coaching & Batches',
          description: 'Coaching Programs, Batches, Schedules, Enrollments & Automated Biometric Attendance [Roles: tenant_admin, coach, student]',
        },
        {
          name: 'Skills & Levels Management',
          description: 'Dynamic Coaching Skill Levels & Trainee Progression Tracking: Full CRUD for skill tiers, benchmark criteria & badges [Roles: tenant_admin, branch_manager, coach, super_admin]',
        },
        {
          name: 'Branches Management',
          description: 'Multi-Branch Setup & Branch-Specific Payment Gateway Routing [Roles: super_admin, tenant_admin]',
        },
        {
          name: 'IoT & Hardware Automation',
          description: 'Hikvision Biometric Terminals, Smart Relay Court Lights/Fans & Door Locks [Roles: tenant_admin, branch_manager, hardware_gateway]',
        },
        {
          name: 'Events & Tournaments',
          description: 'Tournaments, Brackets, Schedules & Registrations [Roles: tenant_admin, customer, member, student]',
        },
        {
          name: 'CRM Enquiries & Leads',
          description: 'Lead Management, Customer Enquiries & Telephony Logs [Roles: tenant_admin, branch_manager, staff]',
        },
        {
          name: 'Announcements',
          description: 'Academy-Wide and Segmented Broadcasts [Roles: tenant_admin, branch_manager, coach, student, member]',
        },
        {
          name: 'IVR Telephony',
          description: 'Cloud Telephony Webhooks & Inbound Call Audits [Roles: tenant_admin, staff]',
        },
        {
          name: 'Finance & Monthly Fees',
          description: 'Automated 1st-of-Month Batch Fee Invoicing, Expenses & P&L Reports [Roles: tenant_admin, finance_manager]',
        },
        {
          name: 'Analytics & Reporting',
          description: 'Court Occupancy, Revenue Reports & Attendance BI Dashboards [Roles: tenant_admin, branch_manager]',
        },
        {
          name: 'Notifications & Alerts',
          description: 'Multi-Channel Dispatch (WhatsApp, SMS, Push, Email, In-App) [Roles: All]',
        },
        {
          name: 'Health',
          description: 'Multi-Service Health & Infrastructure Monitoring (MongoDB, Redis, MQTT) [Roles: All]',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your Bearer JWT Token',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  // Helper to generate role-filtered OpenAPI specification
  const generateFilteredSpec = (filterFn, customInfo) => {
    const fullSpec = fastify.swagger();
    const filteredPaths = {};
    const usedTags = new Set();

    for (const [pathKey, pathItem] of Object.entries(fullSpec.paths || {})) {
      const filteredMethods = {};
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && operation !== null && filterFn(pathKey, method, operation)) {
          filteredMethods[method] = operation;
          if (Array.isArray(operation.tags)) {
            operation.tags.forEach((t) => usedTags.add(t));
          }
        }
      }
      if (Object.keys(filteredMethods).length > 0) {
        filteredPaths[pathKey] = filteredMethods;
      }
    }

    const filteredTags = (fullSpec.tags || []).filter((t) => usedTags.has(t.name));

    return {
      ...fullSpec,
      info: {
        ...fullSpec.info,
        ...customInfo,
      },
      tags: filteredTags,
      paths: filteredPaths,
    };
  };

  // Dedicated OpenAPI JSON routes for Swagger UI role selector
  fastify.get('/api/docs/all/json', async () => fastify.swagger());

  fastify.get('/api/docs/superadmin/json', async () => {
    return generateFilteredSpec(
      (pathKey) => {
        if (pathKey.startsWith('/api/v1/auth/superadmin')) return true;
        if (pathKey.startsWith('/api/v1/academies') || pathKey.startsWith('/api/v1/tenants')) return true;
        if (pathKey.startsWith('/api/v1/branches')) return true;
        if (pathKey.startsWith('/api/v1/roles')) return true;
        if (pathKey.startsWith('/health')) return true;
        return false;
      },
      {
        title: '👑 Platform SuperAdmin Management API',
        description:
          'Global SaaS platform orchestration APIs for SuperAdmins. Includes tenant onboarding, custom domain binding, database isolation management, global branches, system RBAC permissions, and multi-service health diagnostics.',
        version: '1.0.0',
      }
    );
  });

  fastify.get('/api/docs/admin/json', async () => {
    return generateFilteredSpec(
      (pathKey, method) => {
        if (
          pathKey.startsWith('/api/v1/auth/tenant') ||
          pathKey === '/api/v1/auth/login' ||
          pathKey === '/api/v1/auth/register' ||
          pathKey.startsWith('/api/v1/auth/discover') ||
          pathKey.startsWith('/api/v1/academies/lookup')
        )
          return true;
        if (
          pathKey.startsWith('/api/v1/auth/student') ||
          pathKey.startsWith('/api/v1/auth/member') ||
          pathKey.startsWith('/api/v1/auth/booking') ||
          pathKey.startsWith('/api/v1/auth/superadmin')
        )
          return false;
        if ((pathKey.startsWith('/api/v1/academies') || pathKey.startsWith('/api/v1/tenants')) && (method === 'post' || method === 'delete'))
          return false;
        return true;
      },
      {
        title: '🏢 Academy Admin Management API',
        description:
          'Complete academy operations and management APIs for Academy Owners, Branch Managers, Head Coaches, and Desk Staff. Covers sports, courts, lighting relays, coaching batches, monthly fees, members, Hikvision IoT access control, CRM leads, P&L reports, settings, users, and IVR telephony.',
        version: '1.0.0',
      }
    );
  });

  fastify.get('/api/docs/students/json', async () => {
    return generateFilteredSpec(
      (pathKey, method) => {
        if (pathKey.startsWith('/api/v1/auth/student')) return true;
        if (pathKey === '/api/v1/auth/refresh' || pathKey === '/api/v1/auth/logout' || pathKey === '/api/v1/auth/me') return true;
        if (pathKey.startsWith('/api/v1/students')) return true;
        if ((pathKey.startsWith('/api/v1/skills') || pathKey.startsWith('/api/v1/skill-levels')) && method === 'get') return true;
        if (pathKey.startsWith('/api/v1/finance/monthly-fees')) return true;
        if (pathKey.startsWith('/api/v1/coaching/batches') && method === 'get') return true;
        if (pathKey.startsWith('/api/v1/coaching/schedules') && method === 'get') return true;
        if (pathKey.startsWith('/api/v1/announcements') && method === 'get') return true;
        if (pathKey.startsWith('/api/v1/events/tournaments')) return true;
        if (pathKey.startsWith('/api/v1/notifications/my') || pathKey.includes('/read')) return true;
        return false;
      },
      {
        title: '👨‍🎓 Students & Trainees Mobile API',
        description:
          'Dedicated mobile and web portal APIs for Academy Students, Trainees & Parents. Features student login (regNo + Isa@123), single & sibling multi-profile switch, live attendance stats, 1-tap monthly coaching fee payments, face vector onboarding, batch schedules, tournaments, and announcements.',
        version: '1.0.0',
      }
    );
  });

  fastify.get('/api/docs/members/json', async () => {
    return generateFilteredSpec(
      (pathKey, method) => {
        if (pathKey.startsWith('/api/v1/auth/member')) return true;
        if (pathKey === '/api/v1/auth/refresh' || pathKey === '/api/v1/auth/logout') return true;
        if (
          pathKey.startsWith('/api/v1/memberships/my') ||
          pathKey.startsWith('/api/v1/memberships/plans') ||
          pathKey.startsWith('/api/v1/memberships/subscribe') ||
          pathKey.includes('/members/me/')
        )
          return true;
        if (
          pathKey.startsWith('/api/v1/bookings/my') ||
          pathKey.startsWith('/api/v1/bookings/instant-book') ||
          pathKey.startsWith('/api/v1/bookings/hold') ||
          pathKey === '/api/v1/bookings/pin-access' ||
          pathKey.startsWith('/api/v1/bookings/:id')
        )
          return true;
        if (
          pathKey.startsWith('/api/v1/slots/grid') ||
          pathKey.startsWith('/api/v1/slots/hold') ||
          pathKey.startsWith('/api/v1/slots/release')
        )
          return true;
        if (
          (pathKey.startsWith('/api/v1/sports') ||
            pathKey.startsWith('/api/v1/resources') ||
            pathKey.startsWith('/api/v1/branches/active')) &&
          method === 'get'
        )
          return true;
        if (pathKey.startsWith('/api/v1/announcements') && method === 'get') return true;
        if (pathKey.startsWith('/api/v1/events/tournaments')) return true;
        if (pathKey.startsWith('/api/v1/notifications/my') || pathKey.includes('/read')) return true;
        return false;
      },
      {
        title: '💳 Club Members Mobile API',
        description:
          'Dedicated mobile app APIs for Sports Club & Academy Members. Includes subscription management, digital RFID & face sync, discounted court slot booking, 6-digit gate PINs, receipts, and announcements.',
        version: '1.0.0',
      }
    );
  });

  fastify.get('/api/docs/bookings/json', async () => {
    return generateFilteredSpec(
      (pathKey, method) => {
        if (pathKey.startsWith('/api/v1/auth/booking') || pathKey === '/api/v1/auth/register-and-book') return true;
        if (pathKey === '/api/v1/auth/refresh' || pathKey === '/api/v1/auth/logout') return true;
        if (
          pathKey.startsWith('/api/v1/slots')
        )
          return true;
        if (pathKey.startsWith('/api/v1/bookings')) return true;
        if (
          (pathKey.startsWith('/api/v1/sports') ||
            pathKey.startsWith('/api/v1/resources') ||
            pathKey.startsWith('/api/v1/branches/active')) &&
          method === 'get'
        )
          return true;
        if (pathKey.startsWith('/api/v1/events/tournaments')) return true;
        if (pathKey.startsWith('/api/v1/enquiries') && method === 'post') return true;
        return false;
      },
      {
        title: '🏸 Court Bookings & Players API',
        description:
          'High-speed court booking and guest player checkout APIs. Includes real-time court availability grid, 5-minute atomic Redis slot holds, instant checkout, dynamic peak/off-peak pricing, and automated 6-digit gate PIN access control.',
        version: '1.0.0',
      }
    );
  });

  // Swagger UI with interactive dropdown selector for all roles
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      urls: [
        { url: '/api/docs/all/json', name: '🌐 Complete Master API (All 15 Modules)' },
        { url: '/api/docs/superadmin/json', name: '👑 1. SuperAdmin Management API' },
        { url: '/api/docs/admin/json', name: '🏢 2. Admin Management API' },
        { url: '/api/docs/students/json', name: '👨‍🎓 3. Students & Trainees Mobile API' },
        { url: '/api/docs/members/json', name: '💳 4. Club Members Mobile API' },
        { url: '/api/docs/bookings/json', name: '🏸 5. Court Bookings & Players API' },
      ],
      'urls.primaryName': '🌐 Complete Master API (All 15 Modules)',
    },
    staticCSP: false,
  });

  // User-friendly URL redirects and aliases
  const redirectDocs = async (req, reply) => reply.redirect('/api/docs');
  fastify.get('/docs', redirectDocs);
  fastify.get('/api-docs', redirectDocs);
  fastify.get('/documentation', redirectDocs);
  fastify.get('/swagger', redirectDocs);
  fastify.get('/swagger.json', async (req, reply) => reply.redirect('/api/docs/all/json'));
}

export default fp(swaggerPlugin, { name: 'swaggerPlugin' });
