use crate::{DownloadMetadata, DownloadProgress};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, RwLock};

const MAX_JOB_LOG_LINES: usize = 1_000;
const TERMINAL_JOB_TTL: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressPayload {
    pub stage: String,
    pub percent: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobState {
    pub job_id: String,
    pub status: String,
    pub stage: String,
    pub progress: u32,
    pub logs: Vec<String>,
    pub file_path: Option<String>,
    pub metadata: Option<DownloadMetadata>,
    pub install_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<JobProgressPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobLogEvent {
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEndEvent {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub enum JobEvent {
    Progress(JobProgressEvent),
    Log(JobLogEvent),
    End(JobEndEvent),
}

#[derive(Clone)]
pub struct JobHandle {
    state: Arc<RwLock<JobState>>,
    terminal_at: Arc<RwLock<Option<Instant>>>,
    tx: broadcast::Sender<JobEvent>,
}

impl JobHandle {
    pub fn new(job_id: String) -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            state: Arc::new(RwLock::new(JobState {
                job_id,
                status: "queued".to_string(),
                stage: "queued".to_string(),
                progress: 0,
                logs: Vec::new(),
                file_path: None,
                metadata: None,
                install_url: None,
                error: None,
            })),
            terminal_at: Arc::new(RwLock::new(None)),
            tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<JobEvent> {
        self.tx.subscribe()
    }

    pub async fn snapshot(&self) -> JobState {
        self.state.read().await.clone()
    }

    pub async fn append_log(&self, line: impl Into<String>) {
        let line = line.into();
        {
            let mut state = self.state.write().await;
            push_bounded_log(&mut state.logs, line.clone());
        }
        let _ = self.tx.send(JobEvent::Log(JobLogEvent { line }));
    }

    pub async fn set_running(&self) {
        *self.terminal_at.write().await = None;
        let progress_event = {
            let mut state = self.state.write().await;
            state.status = "running".to_string();
            JobProgressEvent {
                status: Some(state.status.clone()),
                progress: Some(JobProgressPayload {
                    stage: state.stage.clone(),
                    percent: state.progress,
                    downloaded: None,
                    total: None,
                    message: None,
                }),
                error: None,
            }
        };
        let _ = self.tx.send(JobEvent::Progress(progress_event));
    }

    pub async fn update_from_progress(&self, progress: &DownloadProgress) {
        let percent = progress.progress.unwrap_or(0.0).round().clamp(0.0, 100.0) as u32;
        let progress_event = {
            let mut state = self.state.write().await;
            if state.status == "ready" || state.status == "failed" {
                return;
            }
            state.status = "running".to_string();
            state.stage = progress.phase.clone();
            if progress.progress.is_some() {
                state.progress = percent;
            }
            JobProgressEvent {
                status: None,
                progress: Some(JobProgressPayload {
                    stage: progress.phase.clone(),
                    percent: state.progress,
                    downloaded: progress.downloaded,
                    total: progress.file_size,
                    message: Some(progress.message.clone()),
                }),
                error: None,
            }
        };
        let _ = self.tx.send(JobEvent::Progress(progress_event));
    }

    pub async fn status(&self) -> String {
        self.state.read().await.status.clone()
    }

    pub async fn mark_ready(
        &self,
        file_path: String,
        metadata: Option<DownloadMetadata>,
        install_url: Option<String>,
    ) {
        *self.terminal_at.write().await = Some(Instant::now());
        let progress_event = {
            let mut state = self.state.write().await;
            state.status = "ready".to_string();
            state.stage = "done".to_string();
            state.progress = 100;
            state.file_path = Some(file_path);
            state.metadata = metadata;
            state.install_url = install_url;
            state.error = None;
            JobProgressEvent {
                status: Some(state.status.clone()),
                progress: Some(JobProgressPayload {
                    stage: state.stage.clone(),
                    percent: state.progress,
                    downloaded: None,
                    total: None,
                    message: Some("任务完成".to_string()),
                }),
                error: None,
            }
        };
        let _ = self.tx.send(JobEvent::Progress(progress_event));
        let _ = self.tx.send(JobEvent::End(JobEndEvent {
            status: "ready".to_string(),
            error: None,
        }));
    }

    pub async fn mark_failed(&self, error: impl Into<String>) {
        let error = error.into();
        *self.terminal_at.write().await = Some(Instant::now());
        let progress_event = {
            let mut state = self.state.write().await;
            state.status = "failed".to_string();
            state.error = Some(error.clone());
            JobProgressEvent {
                status: Some(state.status.clone()),
                progress: Some(JobProgressPayload {
                    stage: state.stage.clone(),
                    percent: state.progress,
                    downloaded: None,
                    total: None,
                    message: None,
                }),
                error: Some(error.clone()),
            }
        };
        let _ = self.tx.send(JobEvent::Progress(progress_event));
        let _ = self.tx.send(JobEvent::End(JobEndEvent {
            status: "failed".to_string(),
            error: Some(error),
        }));
    }

    async fn is_expired_terminal(&self, now: Instant, ttl: Duration) -> bool {
        self.terminal_at
            .read()
            .await
            .is_some_and(|terminal_at| now.duration_since(terminal_at) >= ttl)
    }
}

fn push_bounded_log(logs: &mut Vec<String>, line: String) {
    logs.push(line);
    let excess = logs.len().saturating_sub(MAX_JOB_LOG_LINES);
    if excess > 0 {
        logs.drain(0..excess);
    }
}

#[derive(Clone, Default)]
pub struct JobStore {
    jobs: Arc<RwLock<HashMap<String, JobHandle>>>,
}

impl JobStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn create_job(&self, job_id: String) -> JobHandle {
        self.cleanup().await;
        let job = JobHandle::new(job_id.clone());
        self.jobs.write().await.insert(job_id, job.clone());
        job
    }

    pub async fn get(&self, job_id: &str) -> Option<JobHandle> {
        self.cleanup().await;
        self.jobs.read().await.get(job_id).cloned()
    }

    pub async fn cleanup(&self) {
        self.cleanup_expired(Instant::now(), TERMINAL_JOB_TTL).await;
    }

    async fn cleanup_expired(&self, now: Instant, ttl: Duration) {
        let job_handles = self
            .jobs
            .read()
            .await
            .iter()
            .map(|(job_id, job)| (job_id.clone(), job.clone()))
            .collect::<Vec<_>>();

        let mut expired_job_ids = Vec::new();
        for (job_id, job) in job_handles {
            if job.is_expired_terminal(now, ttl).await {
                expired_job_ids.push(job_id);
            }
        }

        if expired_job_ids.is_empty() {
            return;
        }

        let mut jobs = self.jobs.write().await;
        for job_id in expired_job_ids {
            jobs.remove(&job_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_progress(phase: &str, percent: f64) -> DownloadProgress {
        DownloadProgress {
            phase: phase.to_string(),
            progress: Some(percent),
            downloaded: Some(50),
            file_size: Some(100),
            message: format!("{} {}%", phase, percent),
        }
    }

    #[tokio::test]
    async fn terminal_ready_state_is_not_overwritten_by_late_progress() {
        let job = JobHandle::new("job-ready".to_string());

        job.set_running().await;
        job.mark_ready("/tmp/app.ipa".to_string(), None, None).await;
        job.update_from_progress(&sample_progress("downloading", 42.0))
            .await;

        let snapshot = job.snapshot().await;
        assert_eq!(snapshot.status, "ready");
        assert_eq!(snapshot.stage, "done");
        assert_eq!(snapshot.progress, 100);
    }

    #[tokio::test]
    async fn terminal_failed_state_is_not_overwritten_by_late_progress() {
        let job = JobHandle::new("job-failed".to_string());

        job.set_running().await;
        job.mark_failed("boom").await;
        job.update_from_progress(&sample_progress("downloading", 80.0))
            .await;

        let snapshot = job.snapshot().await;
        assert_eq!(snapshot.status, "failed");
        assert_eq!(snapshot.error.as_deref(), Some("boom"));
    }

    #[tokio::test]
    async fn append_log_keeps_only_recent_entries() {
        let job = JobHandle::new("job-logs".to_string());

        for index in 0..(MAX_JOB_LOG_LINES + 5) {
            job.append_log(format!("line-{index}")).await;
        }

        let snapshot = job.snapshot().await;
        assert_eq!(snapshot.logs.len(), MAX_JOB_LOG_LINES);
        assert_eq!(snapshot.logs.first().map(String::as_str), Some("line-5"));
        assert_eq!(
            snapshot.logs.last().map(String::as_str),
            Some(format!("line-{}", MAX_JOB_LOG_LINES + 4).as_str())
        );
    }

    #[tokio::test]
    async fn cleanup_removes_expired_terminal_jobs_only() {
        let store = JobStore::new();
        let ready_job = store.create_job("ready".to_string()).await;
        let running_job = store.create_job("running".to_string()).await;

        ready_job
            .mark_ready("/tmp/app.ipa".to_string(), None, None)
            .await;
        running_job.set_running().await;
        store
            .cleanup_expired(Instant::now() + Duration::from_secs(1), Duration::ZERO)
            .await;

        assert!(store.get("ready").await.is_none());
        assert!(store.get("running").await.is_some());
    }
}
