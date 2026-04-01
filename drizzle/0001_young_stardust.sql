CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`description` text,
	`serviceAreas` json,
	`specials` text,
	`ctaType` enum('call','book_online','dm','visit_website','custom') DEFAULT 'visit_website',
	`ctaText` varchar(200),
	`ctaLink` varchar(500),
	`ctaPhone` varchar(50),
	`images` json,
	`displayOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastUsedInPostAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shopify_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`shopDomain` varchar(300) NOT NULL,
	`accessToken` text NOT NULL,
	`storeName` varchar(300),
	`isConnected` boolean NOT NULL DEFAULT true,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shopify_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `shopify_connections_brandId_unique` UNIQUE(`brandId`)
);
--> statement-breakpoint
CREATE TABLE `shopify_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`shopifyProductId` varchar(100) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`handle` varchar(300),
	`productType` varchar(200),
	`vendor` varchar(200),
	`tags` json,
	`imageUrl` text,
	`images` json,
	`price` varchar(50),
	`compareAtPrice` varchar(50),
	`inventoryQuantity` int,
	`collections` json,
	`status` varchar(50) DEFAULT 'active',
	`lastUsedInPostAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shopify_products_id` PRIMARY KEY(`id`)
);
