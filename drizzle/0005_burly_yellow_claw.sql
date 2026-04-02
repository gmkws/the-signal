ALTER TABLE `posts` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `lastFailureReason` text;