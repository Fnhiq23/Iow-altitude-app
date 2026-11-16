import { Layout, Menu, theme } from 'antd';
import { Route, Routes, Link } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

function Dashboard() {
  return <div>工作台</div>;
}

function Missions() {
  return <div>任务列表</div>;
}

function Assets() {
  return <div>设备管理</div>;
}

function Incidents() {
  return <div>异常处理</div>;
}

function AuditLogs() {
  return <div>审计日志</div>;
}

export default function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: colorBgContainer }}>
        <div style={{ padding: 16, fontWeight: 700 }}>低空作业协同平台</div>
        <Menu mode="inline" defaultSelectedKeys={['dashboard']}>
          <Menu.Item key="dashboard">
            <Link to="/">工作台</Link>
          </Menu.Item>
          <Menu.Item key="missions">
            <Link to="/missions">任务管理</Link>
          </Menu.Item>
          <Menu.Item key="assets">
            <Link to="/assets">设备管理</Link>
          </Menu.Item>
          <Menu.Item key="incidents">
            <Link to="/incidents">异常处理</Link>
          </Menu.Item>
          <Menu.Item key="audit">
            <Link to="/audit">审计日志</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/audit" element={<AuditLogs />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
