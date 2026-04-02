CREATE TABLE `event_promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`postId` int,
	`brandId` int NOT NULL,
	`promoType` enum('teaser','reminder','day_of','recap') NOT NULL,
	`eventOccurrenceDate` timestamp NOT NULL,
	`scheduledDate` timestamp NOT NULL,
	`status` enum('pending','generated','scheduled','published','skipped') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`description` text,
	`location` varchar(500),
	`ticketLink` varchar(500),
	`eventDate` timestamp NOT NULL,
	`eventEndDate` timestamp,
	`isRecurring` boolean NOT NULL DEFAULT false,
	`recurrencePattern` enum('weekly','biweekly','monthly'),
	`recurrenceEndDate` timestamp,
	`promoLeadDays` json,
	`includeRecap` boolean NOT NULL DEFAULT false,
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `posts` MODIFY COLUMN `contentType` enum('hey_tony','hook_solve','auditor_showcase','local_tips','machine_series','print_digital','product_spotlight','service_highlight','event_teaser','event_reminder','event_day_of','event_recap','custom') NOT NULL DEFAULT 'custom';