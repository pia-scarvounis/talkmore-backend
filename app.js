import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import employeeRoutes from "./db_routes/UsersRoutes/getEmployees_routes.js";
import noteRoutes from "./db_routes/UsersRoutes/notes_routes.js";
import dayOverviewEmployees from "./db_routes/UsersRoutes/dayOverviewEmp.js";
import availableEmployees from "./db_routes/UsersRoutes/availableEmp_router.js";
import employeeHistory from "./db_routes/UsersRoutes/getEmpHistory_router.js";
import metaDataGet from "./db_routes/UsersRoutes/getMetaData_routes.js";

import authRoutes from "./db_routes/Auth_Routes/auth_routes.js";

import adminEmployeeCruds from "./db_routes/AdminRoutes/admin_employeeCruds.js";
import adminHistoryCrud from "./db_routes/AdminRoutes/admin_empHistoryRoutes.js";
import adminTeamCruds from "./db_routes/AdminRoutes/admin_teamCruds.js";
import adminLicenseCruds from "./db_routes/AdminRoutes/admin_licenseCruds.js";

// Cron
console.log("[APP] Starter backend og prøver å importere cron-jobber...");
import "./cronjobs/syncEmployeesCron.js";
import "./cronjobs/deactivateEmployeesCron.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Innlogging
app.use("/api/auth", authRoutes);

// Ruter for admin + teamleder
app.use("/api/employees", employeeRoutes);
app.use("/api/note", noteRoutes);
app.use("/api", dayOverviewEmployees);
app.use("/api/availableemployees", availableEmployees);
app.use("/api/employee/history", employeeHistory);
app.use("/api/metaData", metaDataGet);

// Kun admin
app.use("/api/employee", adminEmployeeCruds);
app.use("/api/history", adminHistoryCrud);
app.use("/api/team", adminTeamCruds);
app.use("/api/license", adminLicenseCruds);

// Starte server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});