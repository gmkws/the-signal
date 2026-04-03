CREATE TABLE `chatbot_flows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`greeting` text NOT NULL,
	`askName` text NOT NULL,
	`askContact` text NOT NULL,
	`askTime` text NOT NULL,
	`closingMessage` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_flows_id` PRIMARY KEY(`id`),
	CONSTRAINT `chatbot_flows_brandId_unique` UNIQUE(`brandId`)
);
--> statement-breakpoint
CREATE TABLE `dm_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`senderId` varchar(128) NOT NULL,
	`platform` enum('instagram','facebook') NOT NULL,
	`state` varchar(50) NOT NULL DEFAULT 'greeting',
	`collectedData` json,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dm_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`platform` enum('instagram','facebook') NOT NULL,
	`senderId` varchar(128) NOT NULL,
	`name` varchar(200),
	`email` varchar(320),
	`phone` varchar(30),
	`serviceNeeded` text,
	`preferredTime` varchar(200),
	`status` enum('new','contacted','qualified','closed','spam') NOT NULL DEFAULT 'new',
	`notes` text,
	`conversationId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
