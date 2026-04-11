ALTER TABLE `social_accounts` MODIFY COLUMN `platform` enum('facebook','instagram','google_business') NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `googleBusinessPostId` varchar(200);--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `refreshToken` text;--> statement-breakpoint
ALTER TABLE `social_accounts` ADD `gbpLocationId` varchar(200);