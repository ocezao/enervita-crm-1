# API Standardization Guide

## Overview
This guide documents the standardization improvements made to the API structure, ensuring consistency, maintainability, and better developer experience.

## New Shared Utilities

### 1. Types (`src/types/api.ts`)
Centralized type definitions for API responses and requests:
- `ApiSuccessResponse<T>` - Standard success response wrapper
- `ApiErrorResponse` - Standard error response format
- `PaginationParams` - Common pagination parameters
- `UuidParam` - UUID parameter interface
- `AuthenticatedRequest` - Request with authenticated user
- `HTTP_STATUS` - HTTP status code constants

### 2. Error Handler (`src/utils/error-handler.ts`)
Unified error handling system:
- Custom error classes: `AppError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`
- `createErrorHandler()` - Unified error handler function for all routes
- `isValidUuid()` - UUID validation utility
- `validateUuidParam()` - UUID parameter validation with standardized errors

### 3. Response Builder (`src/utils/response-builder.ts`)
Standardized response formatting:
- `success<T>()` - Success response builder
- `created<T>()` - Created (201) response builder
- `noContent()` - No content (204) response builder
- `paginated<T>()` - Paginated response builder with metadata

## Module Structure Standards

### Recommended File Structure
```
modules/
├── <module-name>/
│   ├── routes.ts          # Route definitions (required)
│   ├── service.ts         # Business logic (recommended)
│   ├── repository.ts      # Data access (required)
│   ├── validation.ts      # Input validation schemas (recommended)
│   ├── types.ts           # Module-specific types (optional)
│   └── utils.ts           # Module-specific utilities (optional)
```

### Modules Status

| Module | Routes | Service | Repository | Validation | Status |
|--------|--------|---------|------------|------------|--------|
| ads | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| ai | ✅ | ✅ | ❌ | ❌ | Needs repository & validation |
| analytics | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| auth | ✅ | ✅ | ✅ | ⚠️ Partial | Needs complete validation |
| dashboard | ✅ | ✅ | ✅ | ❌ | Needs validation |
| engagement | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| followups | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| integrations | ✅ | ✅ | ✅ | ❌ | Needs validation |
| lead-routing | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| leads | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| notifications | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| permissions | ❌ | ✅ | ❌ | ❌ | Needs routes & repository |
| pipelines | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| proposals | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| solar | ✅ | ❌ | ✅ | ❌ | Needs service & validation |
| users | ✅ | ✅ | ✅ | ✅ | ✅ Complete |

**Legend:** ✅ Complete | ⚠️ Partial | ❌ Missing

## Usage Examples

### Basic Route Pattern
```typescript
import { FastifyInstance } from 'fastify';
import { createErrorHandler } from '../../utils/error-handler';
import { success, created } from '../../utils/response-builder';
import { MyService } from './my.service';

export async function myRoutes(app: FastifyInstance): Promise<void> {
  const errorHandler = createErrorHandler;
  
  app.get('/', async (request, reply) => {
    try {
      const data = await MyService.getAll();
      return success(data).send(reply);
    } catch (error) {
      return errorHandler(reply)(error);
    }
  });
}
```

### Error Handling Pattern
```typescript
import { NotFoundError, BadRequestError } from '../../utils/error-handler';

// Throw standardized errors
if (!item) {
  throw new NotFoundError('Item not found');
}

if (!isValidInput) {
  throw new BadRequestError('Invalid input', { field: 'name' });
}
```

### Response Pattern
```typescript
// Single item
return created(item).send(reply);

// List with pagination
return paginated(items, total, page, limit).send(reply);

// No content
return noContent().send(reply);
```

## Migration Guidelines

### For New Modules
1. Always use shared types from `src/types/api.ts`
2. Use error handlers from `src/utils/error-handler.ts`
3. Use response builders from `src/utils/response-builder.ts`
4. Follow the recommended file structure
5. Add validation schemas for all inputs

### For Existing Modules
Gradually refactor to adopt standards:
1. Replace local error handling with `createErrorHandler`
2. Use response builders instead of manual response formatting
3. Add missing validation schemas
4. Create service layer if missing
5. Update imports to use shared types

## Benefits

- **Consistency**: Uniform API responses across all modules
- **Maintainability**: Centralized error handling and response formatting
- **Developer Experience**: Clear patterns and reduced boilerplate
- **Type Safety**: Shared types ensure consistency
- **Error Tracking**: Standardized error codes and messages
- **Documentation**: Self-documenting API structure

## Next Steps

1. Add validation schemas to modules marked as "Needs validation"
2. Create service layers for modules marked as "Needs service"
3. Refactor existing routes to use new utilities
4. Add OpenAPI/Swagger documentation
5. Implement audit logging middleware
