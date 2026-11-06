export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_OWNER: 'tenant_owner',
  TENANT_ADMIN: 'tenant_admin',
  BRANCH_ADMIN: 'branch_admin',
  MANAGER: 'manager',
  FRONT_DESK: 'front_desk',
  RECEPTIONIST: 'receptionist',
  ACCOUNTANT: 'accountant',
  COACH: 'coach',
  TRAINER: 'trainer',
  STAFF: 'staff',
  MAINTENANCE: 'maintenance',
  SECURITY: 'security',
  CUSTOMER: 'customer',
  MEMBER: 'member',
  STUDENT: 'student',
  PARENT: 'parent',
};

export const PERMISSIONS = {
  // Tenant & Branch
  TENANT_CREATE: 'tenant.create',
  TENANT_VIEW: 'tenant.view',
  TENANT_EDIT: 'tenant.edit',
  BRANCH_CREATE: 'branch.create',
  BRANCH_VIEW: 'branch.view',

  // Facilities & Resources
  RESOURCE_CREATE: 'resource.create',
  RESOURCE_VIEW: 'resource.view',
  RESOURCE_EDIT: 'resource.edit',

  // Slots & Bookings
  SLOT_VIEW: 'slot.view',
  SLOT_HOLD: 'slot.hold',
  BOOKING_CREATE: 'booking.create',
  BOOKING_VIEW: 'booking.view',
  BOOKING_CANCEL: 'booking.cancel',
  BOOKING_REFUND: 'booking.refund',

  // Payments & Invoices
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_REFUND: 'payment.refund',
  INVOICE_GENERATE: 'invoice.generate',

  // Coaching & Students
  STUDENT_CREATE: 'student.create',
  STUDENT_VIEW: 'student.view',
  STUDENT_EDIT: 'student.edit',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_VIEW: 'attendance.view',

  // Expenses & Finance
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_APPROVE: 'expense.approve',
  EXPENSE_VIEW: 'expense.view',

  // Access Control & IoT
  ACCESS_DOOR_OPEN: 'access.door.open',
  ACCESS_PIN_CREATE: 'access.pin.create',
  ACCESS_PIN_REVOKE: 'access.pin.revoke',
  IOT_LIGHT_CONTROL: 'iot.light.control',
  IOT_FAN_CONTROL: 'iot.fan.control',
};

export const BOOKING_STATUS = {
  PENDING: 'pending',
  RESERVED: 'reserved',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  NO_SHOW: 'no_show',
  REFUNDED: 'refunded',
};

export const SLOT_STATUS = {
  AVAILABLE: 'available',
  HELD: 'held',
  BOOKED: 'booked',
  MAINTENANCE: 'maintenance',
  COACHING_BATCH: 'coaching_batch',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};
