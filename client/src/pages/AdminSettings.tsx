import { useEffect, useState } from 'react'
import { Settings, Save, AlertCircle, CheckCircle2, X, RefreshCw, Lock, Mail, Shield, Upload, ToggleLeft, ToggleRight } from 'lucide-react'
import { settingsApi } from '../services/api'

interface SystemSetting {
  id: number
  setting_key: string
  setting_value: string
  description: string | null
  updated_at: string
}

const SETTING_META: Record<string, { label: string; icon: any; group: string }> = {
  max_login_attempts:       { label: 'Max Login Attempts',       icon: Lock,   group: 'Security' },
  lockout_duration_minutes: { label: 'Lockout Duration (min)',    icon: Lock,   group: 'Security' },
  password_min_length:      { label: 'Min Password Length',       icon: Shield, group: 'Security' },
  session_timeout_hours:    { label: 'Session Timeout (hours)',   icon: Lock,   group: 'Security' },
  allow_registration:       { label: 'Allow Registration',       icon: Shield, group: 'Access' },
  require_ibp_verification: { label: 'Require IBP Verification', icon: Shield, group: 'Access' },
  max_file_upload_mb:       { label: 'Max File Upload (MB)',      icon: Upload, group: 'General' },
  maintenance_mode:         { label: 'Maintenance Mode',         icon: Settings, group: 'General' },
  system_email:             { label: 'System Email Address',     icon: Mail,   group: 'General' },
}

const GROUPS = ['Security', 'Access', 'General']

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSettings = () => {
    setLoading(true)
    settingsApi.getAll()
      .then(res => {
        const data = res.data.data as SystemSetting[]
        setSettings(data)
        const vals: Record<string, string> = {}
        data.forEach(s => { vals[s.setting_key] = s.setting_value })
        setEditValues(vals)
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSettings() }, [])

  const handleChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }))
  }

  const isDirty = (key: string) => {
    const original = settings.find(s => s.setting_key === key)
    return original ? original.setting_value !== editValues[key] : false
  }

  const changedCount = settings.filter(s => isDirty(s.setting_key)).length

  const handleSaveAll = async () => {
    setSaving(true)
    setError('')
    try {
      const changed = settings
        .filter(s => isDirty(s.setting_key))
        .map(s => ({ key: s.setting_key, value: editValues[s.setting_key] }))

      await settingsApi.bulkUpdate(changed)
      setSuccess('Settings saved successfully.')
      fetchSettings()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save.')
    } finally { setSaving(false) }
  }

  const isBooleanSetting = (key: string) => ['allow_registration', 'require_ibp_verification', 'maintenance_mode'].includes(key)
  const isNumericSetting = (key: string) => ['max_login_attempts', 'lockout_duration_minutes', 'password_min_length', 'session_timeout_hours', 'max_file_upload_mb'].includes(key)

  const grouped = GROUPS.map(g => ({
    name: g,
    items: settings.filter(s => (SETTING_META[s.setting_key]?.group || 'General') === g),
  })).filter(g => g.items.length > 0)

  return (
    <div className="admin-dash">
      <div className="admin-dash-header">
        <div>
          <h1><Settings size={24} /> System Settings</h1>
          <span className="subtitle">
            {changedCount > 0 ? `${changedCount} unsaved change${changedCount > 1 ? 's' : ''}` : 'All settings saved'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={fetchSettings}><RefreshCw size={16} /></button>
          <button className="btn-primary" onClick={handleSaveAll} disabled={changedCount === 0 || saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <div className="settings-groups">
          {grouped.map(g => (
            <div key={g.name} className="settings-group-card">
              <div className="settings-group-header">
                <h3>{g.name}</h3>
              </div>
              <div className="settings-group-body">
                {g.items.map(s => {
                  const meta = SETTING_META[s.setting_key]
                  const Icon = meta?.icon || Settings
                  const dirty = isDirty(s.setting_key)
                  const boolVal = editValues[s.setting_key] === 'true'

                  return (
                    <div key={s.id} className={`setting-row ${dirty ? 'setting-dirty' : ''}`}>
                      <div className="setting-info">
                        <div className="setting-icon"><Icon size={16} /></div>
                        <div>
                          <label className="setting-label">
                            {meta?.label || s.setting_key}
                            {dirty && <span className="setting-changed-dot" />}
                          </label>
                          {s.description && <small className="setting-desc">{s.description}</small>}
                        </div>
                      </div>
                      <div className="setting-control">
                        {isBooleanSetting(s.setting_key) ? (
                          <button
                            type="button"
                            className={`setting-toggle ${boolVal ? 'toggle-on' : 'toggle-off'}`}
                            onClick={() => handleChange(s.setting_key, boolVal ? 'false' : 'true')}
                          >
                            {boolVal ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            <span>{boolVal ? 'Enabled' : 'Disabled'}</span>
                          </button>
                        ) : isNumericSetting(s.setting_key) ? (
                          <input
                            type="number"
                            value={editValues[s.setting_key] || ''}
                            onChange={e => handleChange(s.setting_key, e.target.value)}
                            min={0}
                            className="setting-input"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editValues[s.setting_key] || ''}
                            onChange={e => handleChange(s.setting_key, e.target.value)}
                            className="setting-input"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
