import React from "react";
import Card from "../components/common/Card.jsx";
import Avatar from "../components/common/Avatar.jsx";
import Badge from "../components/common/Badge.jsx";
import { Pencil } from "lucide-react";
import Empty from "../components/common/Empty.jsx";
export default function UserManagement({
  user,
  data,
  setModal,
  commit
}) {
  return user.role === 'Administrator' ? <Card title="Your care team" subtitle={`${data.users.filter(u => u.active).length} active team members`}>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Team member</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u, i) => <tr key={u.id}>
            <td>
              <div className="person">
                <Avatar name={u.name} index={i} />
                <div>
                  <strong>
                    {u.name}
                    {u.id === user.id ? ' (you)' : ''}
                  </strong>
                  <small>
                    {u.email}
                  </small>
                </div>
              </div>
            </td>
            <td>
              <Badge>
                {u.role}
              </Badge>
            </td>
            <td>
              <Badge>
                {u.active ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td>
              <div className="row">
                <button className="btn secondary small" onClick={() => setModal({
                  type: 'user',
                  item: u
                })}><Pencil size={14} />Edit</button>
                {u.id !== user.id && <button className={`text-button ${u.active ? 'danger-text' : ''}`} onClick={() => setModal({
                  type: 'confirm',
                  title: `${u.active ? 'Deactivate' : 'Activate'} ${u.name}?`,
                  text: u.active ? 'This user will no longer be able to sign in.' : 'This user will regain access to the clinic workspace.',
                  action: () => commit('users', data.users.map(x => x.id === u.id ? {
                    ...x,
                    active: !x.active
                  } : x), u.active ? 'User deactivated' : 'User activated', u.name)
                })}>
                  {u.active ? 'Deactivate' : 'Activate'}
                </button>}
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </Card> : <Empty title="Administrator access required" text="Your clinic staff account does not have access to user management." />;
}
