/**
 * Uniform API Response Utility
 */

export const apiSuccess = ({
  message = 'Operation successful',
  data = {},
  meta = {},
  pagination,
} = {}) => {
  const response = {
    success: true,
    message,
    data,
    meta,
  };
  if (pagination !== undefined) {
    response.pagination = pagination;
  }
  return response;
};

export const apiError = ({
  message = 'An unexpected error occurred',
  code = 'INTERNAL_SERVER_ERROR',
  errors = [],
} = {}) => {
  return {
    success: false,
    message,
    code,
    errors,
  };
};
