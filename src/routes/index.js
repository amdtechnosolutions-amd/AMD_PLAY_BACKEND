import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import tenantRoutes from '../modules/tenants/tenant.routes.js';
import branchRoutes from '../modules/branches/branch.routes.js';
import roleRoutes from '../modules/roles/role.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import sportRoutes from '../modules/sports/sport.routes.js';
import resourceRoutes from '../modules/resources/resource.routes.js';
import slotRoutes from '../modules/slots/slot.routes.js';
import bookingRoutes from '../modules/bookings/booking.routes.js';
import membershipRoutes from '../modules/memberships/membership.routes.js';
import coachingRoutes from '../modules/coaching/coaching.routes.js';
import financeRoutes from '../modules/finance/finance.routes.js';
import iotRoutes from '../modules/iot/iot.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import eventRoutes from '../modules/events/event.routes.js';
import enquiryRoutes from '../modules/enquiries/enquiry.routes.js';
import announcementRoutes from '../modules/announcements/announcement.routes.js';
import ivrRoutes from '../modules/ivr/ivr.routes.js';
import studentRoutes from '../modules/students/student.routes.js';
import skillRoutes from '../modules/skills/skill.routes.js';
import memberRoutes from '../modules/members/member.routes.js';
import bookingUserRoutes from '../modules/booking-users/booking-user.routes.js';
import staffRoutes from '../modules/staff/staff.routes.js';
import tournamentUserRoutes from '../modules/tournament-users/tournament-user.routes.js';

/**
 * Register all application routes with versioning prefix /api/v1
 */
export default async function apiRoutes(fastify) {
  // Top-level Health check routes
  await fastify.register(healthRoutes);

  // Version 1 API routes
  await fastify.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(tenantRoutes);
      await v1.register(branchRoutes);
      await v1.register(roleRoutes);
      await v1.register(userRoutes);
      await v1.register(studentRoutes);
      await v1.register(memberRoutes);
      await v1.register(bookingUserRoutes);
      await v1.register(staffRoutes);
      await v1.register(tournamentUserRoutes);
      await v1.register(skillRoutes);
      await v1.register(sportRoutes);
      await v1.register(resourceRoutes);
      await v1.register(slotRoutes);
      await v1.register(bookingRoutes);
      await v1.register(membershipRoutes);
      await v1.register(coachingRoutes);
      await v1.register(financeRoutes);
      await v1.register(iotRoutes);
      await v1.register(notificationRoutes);
      await v1.register(analyticsRoutes);
      await v1.register(settingsRoutes);
      await v1.register(eventRoutes);
      await v1.register(enquiryRoutes);
      await v1.register(announcementRoutes);
      await v1.register(ivrRoutes);
    },
    { prefix: '/api/v1' }
  );
}
