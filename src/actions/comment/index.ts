/**
 * Centralized Comment Actions
 * All comment-related server actions exported from this file
 */

// Core CRUD actions (with full parameters)
export { createCommentAction } from "./create-comment";
export { updateCommentAction } from "./update-comment";
export { deleteCommentAction } from "./delete-comment";
export { createActivityAction } from "./create-activity";

// Simplified actions (for easier migration from old code)
export { createTaskCommentAction } from "./create-task-comment";
export { fetchCommentsAction } from "./fetch-comments";
export { fetchActivitiesAction } from "./fetch-activities";
export { getNotificationsAction, markTaskCommentsReadAction } from "./get-notifications";

// Re-export types
export type { CreateCommentResult } from "./create-comment";
export type { UpdateCommentResult } from "./update-comment";
export type { DeleteCommentResult } from "./delete-comment";
export type { CreateActivityResult } from "./create-activity";
export type { CreateTaskCommentResult } from "./create-task-comment";
