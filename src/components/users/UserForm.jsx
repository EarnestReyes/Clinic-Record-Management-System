import React from "react";
import Form from "../common/Form.jsx";
export default function UserForm({
  modal,
  user,
  setModal,
  data,
  notify,

  commit
}) {
  return <Form 
    fields={[{
    name: 'name',
    label: 'Full name',
    required: true
  }, {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true
  }, {
    name: 'role',
    label: 'Role',
    options: modal.item?.id === user.id ? ['Administrator'] : ['Clinic Staff', 'Administrator']
  }, {
    name: 'password',
    label: modal.item ? 'New password (optional)' : 'Password (12+ characters)',
    type: 'password',
    required: !modal.item
  }]} 
    values={modal.item ? {
    ...modal.item,
    password: ''
  } : {}} 
    onCancel={() => setModal(null)} 
    onSave={v => {
    if (data.users.some(u => u.id !== modal.item?.id && u.email?.toLowerCase() === v.email.toLowerCase())) return notify('This email address is already in use');
    const u = {
      ...v,
      id: modal.item?.id || 'U-' + Date.now(),
      active: modal.item?.active ?? true,
      password: v.password || modal.item?.password
    };

    return commit('users', modal.item ? data.users.map(x => x.id === u.id ? u : x) : [...data.users, u], modal.item ? 'User edited' : 'User created', u.name);
  }} 
  />;
}
