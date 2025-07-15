export async function getFullEmployeeById(conn, employeeId) {
    const [rows] = await conn.query(`
      SELECT 
        employee.*,
        relative.relative_id,
        relative.relative_name,
        relative.relative_phoneNr,
        team.team_name,
        team.department_id AS department_id,
        department.department_name,
        workPosistion.posistion_title as workPosistion_title,
        l.license_id,
        l.license_title,
        leaveTbl.leave_id,
        leaveTbl.leave_percentage,
        leaveTbl.leave_start_date,
        leaveTbl.leave_end_date
      FROM employee
      LEFT JOIN relative ON employee.employee_id = relative.employee_id
      LEFT JOIN team ON employee.team_id = team.team_id
      LEFT JOIN department ON team.department_id = department.department_id
      LEFT JOIN workPosistion ON employee.workPosistion_id = workPosistion.workPosistion_id
      LEFT JOIN employee_license el ON employee.employee_id = el.employee_id
      LEFT JOIN license l ON el.license_id = l.license_id
      LEFT JOIN employeeLeave leaveTbl ON employee.employee_id = leaveTbl.employee_id
      WHERE employee.employee_id = ?
    `, [employeeId]);
  
    const grouped = rows.reduce((acc, row) => {
      const {
        employee_id,
        relative_id,
        relative_name,
        relative_phoneNr,
        license_id,
        license_title,
        leave_id,
        leave_percentage,
        leave_start_date,
        leave_end_date,
        department_id,
        ...employeeData
      } = row;
  
      if (!acc[employee_id]) {
        acc[employee_id] = {
          employee_id,
          ...employeeData,
          department_id,
          relative: [],
          licenses: [],
          leave: null,
        };
      }
  
      if (relative_id) {
        acc[employee_id].relative.push({ relative_id, relative_name, relative_phoneNr });
      }
  
      if (license_id && license_title) {
        const exists = acc[employee_id].licenses.find(l => l.license_id === license_id);
        if (!exists) {
          acc[employee_id].licenses.push({ license_id, license_title });
        }
      }
  
      if (leave_id && !acc[employee_id].leave) {
        acc[employee_id].leave = {
          leave_id,
          leave_percentage,
          leave_start_date,
          leave_end_date
        };
      }
  
      return acc;
    }, {});
  
    return Object.values(grouped)[0];
  }
  