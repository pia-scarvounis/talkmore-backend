USE defaultdb;

/*Avdeling, skal det legges inn avdelinger*/
create table department(
department_id int auto_increment primary key,
department_name varchar(255)
);

/*Verdier som skal inn i department*/
insert into department(department_name)
values ('Admin'), ('Privat'), ('Bedrift'),('2.Linje');

/*Team, legges inn team med fk til tilhørende avdeling*/
create table team(
team_id int auto_increment primary key,
team_name varchar(255) not null,
department_id int,
constraint fk_department foreign key (department_id) references department(department_id)
);
/*Verdier som skal inn i teams med tilhørende id fra avd*/
insert into team (team_name, department_id)
values 
('Performance Management',1),
('Brooklyn', 2),
('Havana', 2),
('Casablanca', 2),
('Springfield', 2),
('Cayman Island', 3),
('Olympia', 4);

/*Jobb rolle, skal det legges inn alle stilling roller*/
create table workPosistion(
workPosistion_id int auto_increment primary key,
posistion_title varchar(255)
);
/*Verdier stilling tittel */
insert into workPosistion(posistion_title)
values ('Admin'),('Teamleder'),('Kundeagent');

/*Lisenser og tilganger*/
create table license(
license_id int auto_increment primary key,
license_title varchar(255)
);
insert into license(license_title)
values ('license_1'),('license_2'),('license_3');

/*Alle ansatte med tilegginformasjon*/
create table employee(
employee_id int auto_increment primary key,
employee_name varchar(255),
epost varchar(255),
epost_Telenor varchar(255),
phoneNr varchar(15),
birthdate date,
image_url varchar(255),
start_date date not null,
end_date date,
form_of_employeement enum ('Fast', 'Innleid') not null,
employeeNr_Talkmore int,
employeeNr_Telenor int,
employee_percentages tinyint not null,
is_test boolean default false,
is_active boolean default true,
team_id int, 
workPosistion_id int, 
constraint fk_team foreign key (team_id) references team(team_id),
constraint fk_workPosistion foreign key (workPosistion_id) references workPosistion(workPosistion_id)
);

ALTER TABLE employee ADD CONSTRAINT unique_epost UNIQUE (epost);
ALTER TABLE employee
ADD COLUMN genesys_user_id VARCHAR(255),
ADD COLUMN genesys_version INT,
ADD COLUMN genesys_self_uri VARCHAR(255);

/*Legge til navn på jobb tittel og teamnavn*/
ALTER TABLE employee
ADD COLUMN team_name VARCHAR(255),
ADD COLUMN workPosistion_title VARCHAR(255);

/*Ansatte kan ha mange lisenser så setter dette i egen tabell*/
create table employee_license(
employee_license_id int auto_increment primary key,
employee_id int not null,
license_id int not null,
foreign key (employee_id) references employee(employee_id) on delete cascade,
foreign key (license_id) references license(license_id) on delete cascade
);

/*Pårørende til Ansatte*/
create table relative(
relative_id int auto_increment primary key,
relative_name varchar(255),
relative_phoneNr varchar(255),
employee_id int,
constraint fk_employee foreign key (employee_id) references employee(employee_id)
);

/*Dette er tabell for selve brukere av verktøyet (Admin, Teamledere) */
create table userOfTool(
user_id int auto_increment primary key,
roles enum ('Admin', 'Teamleder'),
username varchar(255),
password_hash char(60),
active boolean not null,
is_test boolean default false,
employee_id int,
foreign key (username) references employee(epost),
constraint fk_employeeUser foreign key (employee_id) references employee(employee_id)
);

/*Notater per ansatt (kan legge/redigere av Admin og Teamleder) */
create table note(
note_id int auto_increment primary key,
note text not null,
employee_id int,
createt_by int,
createt_at datetime,
last_modified datetime,
constraint fk_employeeNote foreign key (employee_id) references employee(employee_id),
constraint fk_userId foreign key (createt_by) references userOfTool(user_id)
);

/*Test status for å sjekke tilgjengelige ansatte*/
create table employeeStatus(
status_id int auto_increment primary key,
status_employee enum ('Pålogget', 'Ikke pålogget'),
is_logged_in boolean default false,
employee_id int,
constraint fk_employeeStatus foreign key (employee_id) references employee(employee_id)
);
ALTER TABLE employeeStatus
ADD COLUMN dato DATE;


/*Permisjon detaljer per ansatt*/
create table employeeLeave(
leave_id int auto_increment primary key,
leave_percentage int default null,
leave_start_date date null,
leave_end_date date null,
employee_id int not null
);

/*Historikk på endringer*/
create table changeLog(
changeLog_id int auto_increment primary key,

/*Hvem admin(id) som har endret på hvilken ansatt(id)*/
employee_id int not null,
admin_id int not null,

field_changed VARCHAR(255) NOT NULL,
old_value TEXT,
new_value TEXT,

change_date datetime not null default current_timestamp,

foreign key (employee_id) references employee(employee_id),
foreign key (admin_id) references userOfTool(user_id)
);


/*Tester*/
SELECT * FROM workPosistion;
SELECT * FROM employee;
SELECT * FROM team;
SELECT * FROM department;
SELECT * FROM license;

/*sjekke hvem som er admin eller teamleder*/
SELECT * FROM workPosistion;
SELECT * FROM userOfTool;
SELECT employee_id, active FROM userOfTool WHERE employee_id = 13;


SELECT * FROM userOfTool WHERE user_id = 7;

/*TEST for å sjekke at lisenser er tom når ansatte har sluttet*/
SELECT e.*, el.license_id
FROM employee e
LEFT JOIN employee_license el ON e.employee_id = el.employee_id
WHERE e.employee_id = 95;



-- DESCRIBE department;

-- SET SQL_SAFE_UPDATES = 1;

/*Ikke bruk denne jo mindre man skal fjerne alle ansatte, obs senere kan dette påvirke*/
-- DELETE FROM employee WHERE is_test = true;














