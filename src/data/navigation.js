import { LayoutDashboard, Users, CalendarDays, ClipboardList, Archive, BarChart3, ShieldCheck, UserRound, Settings } from "lucide-react";
export const navigation = [{
  label: 'Overview',
  items: [['Dashboard', LayoutDashboard], ['Patients', Users], ['Appointments', CalendarDays], ['Medical Records', ClipboardList]]
}, {
  label: 'Management',
  items: [['Archived Records', Archive], ['Reports', BarChart3], ['Audit Logs', ShieldCheck], ['User Management', UserRound]]
}, {
  label: 'Workspace',
  items: [['Settings', Settings]]
}];
