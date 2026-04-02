CREATE TABLE `error_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int,
	`postId` int,
	`errorType` enum('post_failure','token_expired','content_generation_failure','api_error','retry_exhausted','system') NOT NULL,
	`severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'error',
	`message` text NOT NULL,
	`details` json,
	`retryCount` int DEFAULT 0,
	`maxRetries` int DEFAULT 3,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
