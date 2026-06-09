import {
  Cable,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  ListRestart,
  Radar,
  Save,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { sourceEngineService } from '@/services/sourceEngineService';
import { formatDate } from '@/lib/utils';
import type {
  AttributionPayload,
  AttributionResult,
  AttributionRule,
  ConnectorStatus,
  RuleMatchField,
  RuleOperator,
  SourceChannel,
  SourceConnector,
  SourceEngineState,
  SourcePlatform,
} from '@/types/sourceEngine';

const platforms: SourcePlatform[] = ['Meta', 'Website', 'Zalo OA', 'Google Ads', 'TikTok Ads', 'Manual', 'Import', 'Other'];
const connectorStatuses: ConnectorStatus[] = ['connected', 'testing', 'needs_setup', 'paused'];
const matchFields: RuleMatchField[] = ['source_id', 'form_id', 'utm_source', 'utm_campaign', 'pixel_id', 'referrer', 'page_slug', 'manual_source'];
const operators: RuleOperator[] = ['equals', 'contains', 'starts_with', 'exists'];
const captureMethods: SourceConnector['captureMethod'][] = ['Webhook', 'API', 'Pixel/CAPI', 'Website Form', 'Manual'];
const credentialStatuses: SourceConnector['credentialStatus'][] = ['ok', 'missing', 'expired', 'not_required'];

function emptySource(): Partial<SourceChannel> {
  return {
    name: '',
    platform: 'Meta',
    priorityLevel: 4,
    defaultCenter: '',
    defaultCourse: '',
    routingHint: 'Auto assign theo rule Phân lead',
    description: '',
    active: true,
  };
}

function emptyConnector(): Partial<SourceConnector> {
  return {
    name: '',
    platform: 'Meta',
    captureMethod: 'Webhook',
    status: 'needs_setup',
    credentialStatus: 'missing',
    identifiers: '',
    testStatus: 'Chưa test',
  };
}

function emptyRule(sourceId = ''): Partial<AttributionRule> {
  return {
    name: '',
    order: 40,
    active: true,
    matchField: 'utm_source',
    operator: 'contains',
    matchValue: '',
    sourceId,
    confidence: 80,
    notes: '',
  };
}

function statusTone(status: ConnectorStatus): Parameters<typeof Badge>[0]['tone'] {
  if (status === 'connected') return 'green';
  if (status === 'testing') return 'amber';
  if (status === 'paused') return 'gray';
  return 'orange';
}

function confidenceTone(value: number): Parameters<typeof Badge>[0]['tone'] {
  if (value >= 85) return 'green';
  if (value >= 60) return 'amber';
  return 'red';
}

export default function SourceEnginePage() {
  const [state, setState] = useState<SourceEngineState>({ sources: [], connectors: [], rules: [], logs: [] });
  const [tab, setTab] = useState<'sources' | 'connectors' | 'rules' | 'logs'>('sources');
  const [sourceDraft, setSourceDraft] = useState<Partial<SourceChannel>>(emptySource());
  const [connectorDraft, setConnectorDraft] = useState<Partial<SourceConnector>>(emptyConnector());
  const [ruleDraft, setRuleDraft] = useState<Partial<AttributionRule>>(emptyRule());
  const [payload, setPayload] = useState<AttributionPayload>({
    leadName: 'Lead test từ Meta',
    rawChannel: 'Meta webhook',
    form_id: 'meta_kiddies_form_01',
    utm_source: 'meta',
    utm_campaign: 'kiddies_june',
    referrer: 'facebook.com',
  });
  const [result, setResult] = useState<AttributionResult | null>(null);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const next = await sourceEngineService.getState();
    setState(next);
    setRuleDraft((current) => current.sourceId ? current : emptyRule(next.sources[0]?.id || ''));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const sourceById = useMemo(() => new Map(state.sources.map((source) => [source.id, source])), [state.sources]);
  const metrics = useMemo(() => {
    const activeSources = state.sources.filter((source) => source.active).length;
    const connected = state.connectors.filter((connector) => connector.status === 'connected').length;
    const activeRules = state.rules.filter((rule) => rule.active).length;
    const reviewLogs = state.logs.filter((log) => log.status === 'review').length;
    return { activeSources, connected, activeRules, reviewLogs };
  }, [state]);

  async function saveSource() {
    const next = await sourceEngineService.saveSource(sourceDraft);
    setState(next);
    setSourceDraft(emptySource());
    setMessage('Đã lưu source.');
  }

  async function saveConnector() {
    const next = await sourceEngineService.saveConnector(connectorDraft);
    setState(next);
    setConnectorDraft(emptyConnector());
    setMessage('Đã lưu connector.');
  }

  async function saveRule() {
    const next = await sourceEngineService.saveRule(ruleDraft);
    setState(next);
    setRuleDraft(emptyRule(next.sources[0]?.id || ''));
    setMessage('Đã lưu rule attribution.');
  }

  async function testAttribution() {
    const output = await sourceEngineService.testAttribution(payload);
    setState(output.state);
    setResult(output.result);
    setTab('rules');
    setMessage(output.result.source ? `Matched: ${output.result.source.name}` : 'Chưa match rule, cần review.');
  }

  async function resetSamples() {
    const next = await sourceEngineService.resetSamples();
    setState(next);
    setResult(null);
    setSourceDraft(emptySource());
    setConnectorDraft(emptyConnector());
    setRuleDraft(emptyRule(next.sources[0]?.id || ''));
    setMessage('Đã reset Source Engine về data mẫu.');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Source Engine</h1>
          <p className="text-slate-500">Thiết lập nguồn lead, connector, rule attribution và log kiểm tra cho team Ads.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()}><Search /> Refresh</Button>
          <Button variant="outline" onClick={() => void resetSamples()}><ListRestart /> Reset mẫu</Button>
        </div>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Active sources" value={metrics.activeSources} />
        <MetricCard label="Connected connectors" value={metrics.connected} />
        <MetricCard label="Active rules" value={metrics.activeRules} />
        <MetricCard label="Need review" value={metrics.reviewLogs} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger active={tab === 'sources'} onClick={() => setTab('sources')}>Sources</TabsTrigger>
            <TabsTrigger active={tab === 'connectors'} onClick={() => setTab('connectors')}>Connectors</TabsTrigger>
            <TabsTrigger active={tab === 'rules'} onClick={() => setTab('rules')}>Rules</TabsTrigger>
            <TabsTrigger active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</TabsTrigger>
          </TabsList>

          {tab === 'sources' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Radar size={18} /> Source Library</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input placeholder="Tên source" value={sourceDraft.name || ''} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} />
                  <Select value={sourceDraft.platform || 'Meta'} onChange={(event) => setSourceDraft({ ...sourceDraft, platform: event.target.value as SourcePlatform })}>
                    {platforms.map((platform) => <option key={platform}>{platform}</option>)}
                  </Select>
                  <Select value={String(sourceDraft.priorityLevel || 4)} onChange={(event) => setSourceDraft({ ...sourceDraft, priorityLevel: Number(event.target.value) as SourceChannel['priorityLevel'] })}>
                    {[5, 4, 3, 2, 1].map((level) => <option key={level} value={level}>P{level}</option>)}
                  </Select>
                  <Input placeholder="Default center" value={sourceDraft.defaultCenter || ''} onChange={(event) => setSourceDraft({ ...sourceDraft, defaultCenter: event.target.value })} />
                  <Input placeholder="Default course" value={sourceDraft.defaultCourse || ''} onChange={(event) => setSourceDraft({ ...sourceDraft, defaultCourse: event.target.value })} />
                  <Input placeholder="Routing hint" value={sourceDraft.routingHint || ''} onChange={(event) => setSourceDraft({ ...sourceDraft, routingHint: event.target.value })} />
                  <Textarea className="md:col-span-3" placeholder="Mô tả source và rule vận hành" value={sourceDraft.description || ''} onChange={(event) => setSourceDraft({ ...sourceDraft, description: event.target.value })} />
                </div>
                <Button className="w-fit" onClick={() => void saveSource()}><Save /> Lưu source</Button>
                <Table>
                  <THead><TR><TH>Source</TH><TH>Platform</TH><TH>Priority</TH><TH>Default</TH><TH>Routing</TH><TH>Status</TH></TR></THead>
                  <TBody>
                    {state.sources.map((source) => (
                      <TR key={source.id}>
                        <TD><button className="text-left font-bold text-slate-950" onClick={() => setSourceDraft(source)}>{source.name}</button><p className="text-xs text-slate-500">{source.description}</p></TD>
                        <TD>{source.platform}</TD>
                        <TD><Badge tone={source.priorityLevel >= 4 ? 'orange' : 'gray'}>P{source.priorityLevel}</Badge></TD>
                        <TD>{source.defaultCenter || '-'}<p className="text-xs text-slate-500">{source.defaultCourse || '-'}</p></TD>
                        <TD>{source.routingHint}</TD>
                        <TD><Badge tone={source.active ? 'green' : 'gray'}>{source.active ? 'Active' : 'Paused'}</Badge></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {tab === 'connectors' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Cable size={18} /> Connector Setup</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input placeholder="Tên connector" value={connectorDraft.name || ''} onChange={(event) => setConnectorDraft({ ...connectorDraft, name: event.target.value })} />
                  <Select value={connectorDraft.platform || 'Meta'} onChange={(event) => setConnectorDraft({ ...connectorDraft, platform: event.target.value as SourcePlatform })}>
                    {platforms.map((platform) => <option key={platform}>{platform}</option>)}
                  </Select>
                  <Select value={connectorDraft.captureMethod || 'Webhook'} onChange={(event) => setConnectorDraft({ ...connectorDraft, captureMethod: event.target.value as SourceConnector['captureMethod'] })}>
                    {captureMethods.map((method) => <option key={method}>{method}</option>)}
                  </Select>
                  <Select value={connectorDraft.status || 'needs_setup'} onChange={(event) => setConnectorDraft({ ...connectorDraft, status: event.target.value as ConnectorStatus })}>
                    {connectorStatuses.map((status) => <option key={status}>{status}</option>)}
                  </Select>
                  <Select value={connectorDraft.credentialStatus || 'missing'} onChange={(event) => setConnectorDraft({ ...connectorDraft, credentialStatus: event.target.value as SourceConnector['credentialStatus'] })}>
                    {credentialStatuses.map((status) => <option key={status}>{status}</option>)}
                  </Select>
                  <Input placeholder="Test status" value={connectorDraft.testStatus || ''} onChange={(event) => setConnectorDraft({ ...connectorDraft, testStatus: event.target.value })} />
                  <Textarea className="md:col-span-3" placeholder="Identifiers: ad_account_id, page_id, form_id, pixel_id, webhook secret..." value={connectorDraft.identifiers || ''} onChange={(event) => setConnectorDraft({ ...connectorDraft, identifiers: event.target.value })} />
                </div>
                <Button className="w-fit" onClick={() => void saveConnector()}><Save /> Lưu connector</Button>
                <Table>
                  <THead><TR><TH>Connector</TH><TH>Capture</TH><TH>Status</TH><TH>Credential</TH><TH>Identifiers</TH><TH>Last sync</TH></TR></THead>
                  <TBody>
                    {state.connectors.map((connector) => (
                      <TR key={connector.id}>
                        <TD><button className="text-left font-bold text-slate-950" onClick={() => setConnectorDraft(connector)}>{connector.name}</button><p className="text-xs text-slate-500">{connector.platform}</p></TD>
                        <TD>{connector.captureMethod}</TD>
                        <TD><Badge tone={statusTone(connector.status)}>{connector.status}</Badge></TD>
                        <TD>{connector.credentialStatus}</TD>
                        <TD className="max-w-xs text-xs text-slate-500">{connector.identifiers}</TD>
                        <TD>{connector.lastSyncAt ? formatDate(connector.lastSyncAt, true) : '-'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {tab === 'rules' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch size={18} /> Attribution Rules</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Input placeholder="Tên rule" value={ruleDraft.name || ''} onChange={(event) => setRuleDraft({ ...ruleDraft, name: event.target.value })} />
                  <Input type="number" placeholder="Order" value={ruleDraft.order || 10} onChange={(event) => setRuleDraft({ ...ruleDraft, order: Number(event.target.value) })} />
                  <Select value={ruleDraft.matchField || 'utm_source'} onChange={(event) => setRuleDraft({ ...ruleDraft, matchField: event.target.value as RuleMatchField })}>
                    {matchFields.map((field) => <option key={field}>{field}</option>)}
                  </Select>
                  <Select value={ruleDraft.operator || 'contains'} onChange={(event) => setRuleDraft({ ...ruleDraft, operator: event.target.value as RuleOperator })}>
                    {operators.map((operator) => <option key={operator}>{operator}</option>)}
                  </Select>
                  <Input placeholder="Match value" value={ruleDraft.matchValue || ''} onChange={(event) => setRuleDraft({ ...ruleDraft, matchValue: event.target.value })} />
                  <Select value={ruleDraft.sourceId || state.sources[0]?.id || ''} onChange={(event) => setRuleDraft({ ...ruleDraft, sourceId: event.target.value })}>
                    {state.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </Select>
                  <Input type="number" min={0} max={100} placeholder="Confidence %" value={ruleDraft.confidence || 80} onChange={(event) => setRuleDraft({ ...ruleDraft, confidence: Number(event.target.value) })} />
                  <Input placeholder="Notes" value={ruleDraft.notes || ''} onChange={(event) => setRuleDraft({ ...ruleDraft, notes: event.target.value })} />
                </div>
                <Button className="w-fit" onClick={() => void saveRule()}><Save /> Lưu rule</Button>
                {result && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-bold text-slate-950">Kết quả test: {result.source?.name || 'Needs review'}</p>
                    <p className="mt-1 text-sm text-slate-500">Rule: {result.rule?.name || 'No rule matched'} · Confidence {result.confidence}%</p>
                  </div>
                )}
                <Table>
                  <THead><TR><TH>Order</TH><TH>Rule</TH><TH>Match</TH><TH>Assign source</TH><TH>Confidence</TH><TH>Status</TH></TR></THead>
                  <TBody>
                    {state.rules.map((rule) => (
                      <TR key={rule.id}>
                        <TD>{rule.order}</TD>
                        <TD><button className="text-left font-bold text-slate-950" onClick={() => setRuleDraft(rule)}>{rule.name}</button><p className="text-xs text-slate-500">{rule.notes}</p></TD>
                        <TD><span className="font-mono text-xs">{rule.matchField} {rule.operator} {rule.matchValue || '*'}</span></TD>
                        <TD>{sourceById.get(rule.sourceId)?.name || '-'}</TD>
                        <TD><Badge tone={confidenceTone(rule.confidence)}>{rule.confidence}%</Badge></TD>
                        <TD><Badge tone={rule.active ? 'green' : 'gray'}>{rule.active ? 'Active' : 'Paused'}</Badge></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {tab === 'logs' && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal size={18} /> Attribution Logs</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead><TR><TH>Lead</TH><TH>Raw channel</TH><TH>Campaign</TH><TH>Source</TH><TH>Rule</TH><TH>Confidence</TH><TH>Received</TH></TR></THead>
                  <TBody>
                    {state.logs.map((log) => (
                      <TR key={log.id}>
                        <TD className="font-bold text-slate-950">{log.leadName}</TD>
                        <TD>{log.rawChannel}</TD>
                        <TD>{log.campaign || '-'}</TD>
                        <TD><Badge tone={log.status === 'matched' ? 'green' : log.status === 'warning' ? 'amber' : 'red'}>{log.sourceName}</Badge></TD>
                        <TD>{log.matchedRuleName}</TD>
                        <TD>{log.confidence}%</TD>
                        <TD>{formatDate(log.receivedAt, true)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical size={18} /> Test Payload</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Input placeholder="Lead name" value={payload.leadName || ''} onChange={(event) => setPayload({ ...payload, leadName: event.target.value })} />
              <Input placeholder="Raw channel" value={payload.rawChannel || ''} onChange={(event) => setPayload({ ...payload, rawChannel: event.target.value })} />
              <Input placeholder="form_id" value={payload.form_id || ''} onChange={(event) => setPayload({ ...payload, form_id: event.target.value })} />
              <Input placeholder="utm_source" value={payload.utm_source || ''} onChange={(event) => setPayload({ ...payload, utm_source: event.target.value })} />
              <Input placeholder="utm_campaign" value={payload.utm_campaign || ''} onChange={(event) => setPayload({ ...payload, utm_campaign: event.target.value })} />
              <Input placeholder="referrer" value={payload.referrer || ''} onChange={(event) => setPayload({ ...payload, referrer: event.target.value })} />
              <Button onClick={() => void testAttribution()}><CheckCircle2 /> Test attribution</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Setup Flow</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {[
                '1. Tạo source và set priority/center/course mặc định.',
                '2. Kết nối connector: Meta, Website, Zalo OA, Google/TikTok.',
                '3. Tạo rule match theo form_id, UTM, pixel_id, referrer.',
                '4. Test payload để xem source, confidence và log review.',
                '5. Khi backend/API sẵn sàng, connector sẽ đẩy payload thật vào engine này.',
              ].map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold">{item}</div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
