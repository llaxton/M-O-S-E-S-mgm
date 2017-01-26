import { Action } from 'redux';
import { Record, Map } from 'immutable';
import { IJob } from '../../../common/messages';

const UPSERT_JOB = "ACCOUNT_UPSERT_JOB";
const DELETE_JOB = "ACCOUNT_DELETE_JOB";
const UPSERT_JOB_BULK = "ACCOUNT_UPSERT_JOB_BULK";

interface JobAction extends Action {
  job: Job
}

interface JobActionBulk extends Action {
  jobs: Job[]
}

const JobClass = Record({
  id: 0,
  timestamp: '',
  type: '',
  user: '',
  data: ''
})

export class Job extends JobClass implements IJob {
  id: number
  timestamp: string
  type: string
  user: string
  data: string

  set(key: string, value: string | number): Job {
    return <Job>super.set(key, value);
  }
}

// internal function for code reuse concerning immutable objects
function upsertJob(state: Map<number, Job>, j: Job): Map<number, Job> {
  let rec = state.get(j.id) || new Job();
  return state.set(
    j.id,
    rec.set('id', j.id)
      .set('timestamp', j.timestamp)
      .set('type', j.type)
      .set('user', j.user)
      .set('data', j.data)
  );
}

export const DeleteJobAction = function (job: Job): Action {
  let act: JobAction = {
    type: DELETE_JOB,
    job: job
  }
  return act
}

export const UpsertJobAction = function (job: Job): Action {
  let act: JobAction = {
    type: UPSERT_JOB,
    job: job
  }
  return act
}

export const UpsertJobBulkAction = function (job: Job[]): Action {
  let act: JobActionBulk = {
    type: UPSERT_JOB_BULK,
    jobs: job
  }
  return act
}

export const JobsReducer = function (state = Map<number, Job>(), action: Action): Map<number, Job> {
  switch (action.type) {
    case UPSERT_JOB:
      let j = <JobAction>action;
      return upsertJob(state, j.job);
    case UPSERT_JOB_BULK:
      let jb = <JobActionBulk>action;
      jb.jobs.map((r: Job) => {
        state = upsertJob(state, r);
      })
      return state;
    case DELETE_JOB:
      j = <JobAction>action;
      return state.delete(j.job.id)
    default:
      return state;
  }
}