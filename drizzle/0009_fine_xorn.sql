ALTER TABLE `posts` ADD `uploadedMediaUrl` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `uploadedMediaType` enum('image','video');