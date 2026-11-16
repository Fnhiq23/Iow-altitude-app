import { Layout, Menu, Button, Card, Form, Input, message, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';

const { Header, Content, Sider } = Layout;

type Row = Record<string, any> & { id: string };

function Login({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);

  async function submit(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const result = await api.post('/auth/login', values);
      localStorage.setItem('accessToken', result.data.accessToken);
      onLogin();
      message.success('登录成功');
    } catch (error: any) {
      message.error(error.response?.data?.message ?? '登录失败，请检查账号和密码');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '12vh auto' }}>
      <Card title="低空作业协同平台登录">
        <Form layout="vertical" onFinish={submit}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}> 
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}> 
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}

function ResourcePage({ title, path, fields }: { title: string; path: string; fields: { name: string; label: string; required?: boolean }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  async function load() {
    try {
      const response = await api.get(`/${path}`);
      setRows(response.data);
    } catch {
      message.error(`无法加载${title}，请检查登录状态和 API`);
    }
  }

  useEffect(() => {
    void load();
  }, [path]);

  async function handleCreate(values: Record<string, unknown>) {
    setLoading(true);
    try {
      await api.post(`/${path}`, values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error: any) {
      message.error(error.response?.data?.message ?? '创建失败');
    } finally {
      setLoading(false);
    }
  }

  const columns: ColumnsType<Row> = [
    {
      title: '标题',
      dataIndex: path === 'assets' ? 'name' : 'title',
      key: 'label',
      render: (value: string, record: Row) => value ?? record.description ?? record.type ?? '—',
    },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value) => <Tag>{value ?? '—'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (value) => (value ? new Date(value).toLocaleString() : '—') },
  ];

  return (
    <Card title={title} extra={<Button type="primary" onClick={() => setOpen(true)}>新建</Button>}>
      <Table rowKey="id" columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />
      <Modal title={`新建${title}`} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={loading}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {fields.map((field) => (
            <Form.Item key={field.name} name={field.name} label={field.label} rules={field.required ? [{ required: true }] : []}>
              <Input />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Card>
  );
}

function Dashboard() {
  return (
    <Card title="工作台">
      <Typography.Paragraph>开始管理任务、设备、异常与审计。平台不替代监管审批，也不直接判定飞行安全。</Typography.Paragraph>
      <Space>
        <Link to="/missions">任务管理</Link>
        <Link to="/assets">设备管理</Link>
        <Link to="/incidents">异常处理</Link>
      </Space>
    </Card>
  );
}

function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api
      .get('/audit-logs')
      .then((response) => setRows(response.data))
      .catch(() => message.error('无��计权限或加载失败'));
  }, []);

  return (
    <Card title="审计日志">
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          { title: '时间', dataIndex: 'created_at', render: (value) => (value ? new Date(value).toLocaleString() : '—') },
          { title: '操作', dataIndex: 'action' },
          { title: '对象类型', dataIndex: 'entity_type' },
          { title: '对象 ID', dataIndex: 'entity_id' },
          { title: '用户', dataIndex: 'user_id' },
        ]}
      />
    </Card>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem('accessToken')));
  const location = useLocation();
  const navigate = useNavigate();

  if (!loggedIn) {
    return <Login onLogin={() => { setLoggedIn(true); navigate('/'); }} />;
  }

  const selectedKey = location.pathname.split('/')[1] || 'dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ color: '#fff', padding: 18, fontWeight: 700 }}>低空作业协同平台</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]}>
          <Menu.Item key="dashboard"><Link to="/">工作台</Link></Menu.Item>
          <Menu.Item key="missions"><Link to="/missions">任务管理</Link></Menu.Item>
          <Menu.Item key="assets"><Link to="/assets">设备管理</Link></Menu.Item>
          <Menu.Item key="incidents"><Link to="/incidents">异常处理</Link></Menu.Item>
          <Menu.Item key="audit"><Link to="/audit">审计日志</Link></Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 16px' }}>
          <Button onClick={() => { localStorage.removeItem('accessToken'); setLoggedIn(false); navigate('/'); }}>退出登录</Button>
        </Header>
        <Content style={{ margin: 16 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/missions" element={<ResourcePage title="任务" path="missions" fields={[{ name: 'title', label: '任务标题', required: true }, { name: 'mission_type', label: '任务类型', required: true }, { name: 'priority', label: '优先级' }]} />} />
            <Route path="/assets" element={<ResourcePage title="设备" path="assets" fields={[{ name: 'name', label: '设备名称', required: true }, { name: 'asset_type', label: '设备类型', required: true }, { name: 'model', label: '型号' }]} />} />
            <Route path="/incidents" element={<ResourcePage title="异常" path="incidents" fields={[{ name: 'type', label: '异常类型', required: true }, { name: 'description', label: '描述', required: true }, { name: 'severity', label: '严重程度' }]} />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
