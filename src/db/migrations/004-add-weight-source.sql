ALTER TABLE profile ADD COLUMN weight_source TEXT CHECK(weight_source IN ('measured', 'estimated')) DEFAULT 'estimated';
