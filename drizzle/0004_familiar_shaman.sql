CREATE TABLE `brand_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(320),
	`tier` enum('managed','premium') NOT NULL DEFAULT 'managed',
	`brandName` varchar(200),
	`createdBy` int NOT NULL,
	`expiresAt` timestamp,
	`usedAt` timestamp,
	`usedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 1,
	`stepData` json,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`brandId` int,
	`approvalStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboarding_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `onboarding_state_userId_unique` UNIQUE(`userId`)
);
