import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import '../styles/support.css';

type ReasonKey =
  | 'rule_violation'
  | 'abuse'
  | 'invalid_profile'
  | 'cheating'
  | 'other';

const REASONS: { key: ReasonKey; label: string }[] = [
  { key: 'rule_violation', label: 'Нарушение правил игры' },
  { key: 'abuse', label: 'Оскорбления / мешает игре' },
  { key: 'invalid_profile', label: 'Недопустимый профиль' },
  { key: 'cheating', label: 'Подозрение на мошенничество / чит' },
  { key: 'other', label: 'Другое' },
];

const MAX_FILES = 5;

const Support: React.FC = () => {
  const [nick, setNick] = useState<string>('');
  const [reason, setReason] = useState<ReasonKey | ''>('');
  const [description, setDescription] = useState<string>('');
  const [lobbyId, setLobbyId] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChooseFiles = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFilesSelected = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const list = ev.target.files;
    if (!list) return;
    const arr = Array.from(list).slice(0, MAX_FILES);
    setFiles((prev) => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES);
      return combined;
    });
    // reset to allow selecting same file again if needed
    ev.currentTarget.value = '';
  };

  const removeFileAt = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    if (!nick.trim()) return 'Укажите никнейм';
    if (!reason) return 'Выберите причину обращения';
    if (description.trim().length < 10) return 'Опишите проблему подробнее (не менее 10 символов)';
    return null;
  };

  const onSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      // scroll to top of form area
      (document.getElementById('support-form') || document.body).scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      // Здесь: реальная отправка на сервер (fetch/axios). Пока делаем демонстрационный вывод в консоль.
      // Пример payload:
      const payload = {
        nick,
        reason,
        description,
        lobbyId: lobbyId || null,
        filesMeta: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        ts: new Date().toISOString(),
      };

      console.log('Support payload (demo):', payload);
      // Если нужен реальный запрос:
      // const form = new FormData();
      // form.append('nick', nick); form.append('reason', reason); ...
      // files.forEach(f => form.append('attachments', f));
      // await fetch('/api/support', { method: 'POST', body: form });

      // show success
      setSent(true);
      setTimeout(() => {
        setNick('');
        setReason('');
        setDescription('');
        setLobbyId('');
        setFiles([]);
        setSent(false);
      }, 2200);
    } catch (err) {
      console.error(err);
      setError('Ошибка отправки. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-page">
      <motion.div
        className="support-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36 }}
      >
        <header className="support-header">
          <h1>Техподдержка</h1>
          <p className="support-lead">
            Опишите проблему максимально подробно — это ускорит проверку. Укажите ID лобби, если обращение связано с конкретной партией.
          </p>
        </header>

        <form id="support-form" className="support-form" onSubmit={onSubmit} noValidate>
          <div className="row two-cols">
            <label className="field">
              <span className="field-label">Никнейм</span>
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Ваш никнейм в игре"
                aria-label="Никнейм"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Причина обращения</span>
              <div className="select-wrap">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReasonKey)}
                  aria-label="Причина обращения"
                  required
                >
                  <option value="">Выберите причину...</option>
                  {REASONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <svg className="select-caret" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Коротко опишите ситуацию</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что произошло, шаги воспроизведения, время, ник/ID оппонента..."
              rows={6}
              aria-label="Описание ситуации"
              required
            />
          </label>

          <div className="row two-cols">
            <label className="field">
              <span className="field-label">ID лобби / комнаты (если есть)</span>
              <input
                value={lobbyId}
                onChange={(e) => setLobbyId(e.target.value)}
                placeholder="Опционально — e.g. 1234ABCD"
                aria-label="ID лобби"
              />
            </label>

            <div className="field">
              <span className="field-label">Прикрепить файлы</span>
              <div className="attach-row">
                <button
                  type="button"
                  className="attach-btn"
                  onClick={handleChooseFiles}
                  aria-label="Прикрепить файлы"
                >
                  Прикрепить файл{files.length ? ` (${files.length})` : ''}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.txt,.log"
                  multiple
                  onChange={onFilesSelected}
                  style={{ display: 'none' }}
                />
                <div className="attached-list" aria-live="polite">
                  {files.length === 0 ? (
                    <div className="attached-empty">Нет файлов</div>
                  ) : (
                    files.map((f, i) => (
                      <div className="attached-item" key={`${f.name}-${i}`}>
                        <span className="fname">{f.name}</span>
                        <button type="button" className="remove-file" onClick={() => removeFileAt(i)} aria-label={`Удалить ${f.name}`}>
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="attach-hint">Можно прикрепить до {MAX_FILES} файлов — скриншоты/логи помогут разобраться быстрее.</div>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Отправка...' : 'Отправить обращение'}
            </button>

            <button
              type="button"
              className="btn-cancel"
              onClick={() => {
                setNick('');
                setReason('');
                setDescription('');
                setLobbyId('');
                setFiles([]);
                setError(null);
              }}
            >
              Отменить
            </button>
          </div>
        </form>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={sent ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.36 }}
          className="support-sent"
          aria-hidden={!sent}
        >
          <div className="sent-icon">✅</div>
          <div className="sent-title">Обращение отправлено</div>
          <div className="sent-sub">Спасибо — мы свяжемся с вами в ближайшее время.</div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Support;
