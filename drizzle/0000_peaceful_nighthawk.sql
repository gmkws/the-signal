CREATE TABLE `analytics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`postId` int,
	`platform` enum('facebook','instagram') NOT NULL,
	`impressions` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`engagement` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	`snapshotDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`logoUrl` text,
	`industry` varchar(100),
	`location` varchar(200),
	`website` varchar(500),
	`voiceSettings` json,
	`clientTier` enum('managed','premium') NOT NULL DEFAULT 'managed',
	`autoPostEnabled` boolean NOT NULL DEFAULT false,
	`clientUserId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`postId` int,
	`type` enum('pause_request','edit_request','approval','rejection','post_published','post_failed','system') NOT NULL,
	`title` varchar(300) NOT NULL,
	`message` text,
	`fromUserId` int,
	`toRole` enum('admin','client') NOT NULL DEFAULT 'admin',
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`contentType` enum('hey_tony','hook_solve','auditor_showcase','local_tips','machine_series','print_digital','custom') NOT NULL DEFAULT 'custom',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`status` enum('draft','scheduled','pending_review','approved','published','failed','paused') NOT NULL DEFAULT 'draft',
	`platforms` json,
	`facebookPostId` varchar(200),
	`instagramPostId` varchar(200),
	`aiGenerated` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`lastEditedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`platform` enum('facebook','instagram') NOT NULL,
	`platformAccountId` varchar(200) NOT NULL,
	`accountName` varchar(300),
	`accessToken` text,
	`tokenExpiresAt` timestamp,
	`pageId` varchar(200),
	`instagramBusinessId` varchar(200),
	`isConnected` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
