import { memo, useState } from 'react';
import { ChevronDown } from 'react-feather';
import moment from 'moment';
import Jobs from '../../../models/jobs';
import useUser from '../../../hooks/useUser';

export default function JobsList({ jobs }: { jobs: any[] }) {
  const { user } = useUser();

  return (
    <div className="col-span-12 flex-1 rounded-sm bg-white pb-6 xl:col-span-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="mb-6 px-7.5 text-3xl font-semibold text-black dark:text-white">
            Organization Background Jobs
          </h4>
        </div>
      </div>

      <div className="px-6">
        {jobs.length === 0 ? (
          <div>
            <p className="text-center text-gray-600">
              no background jobs have been run yet.
            </p>
          </div>
        ) : (
          <>
            <div
              id="accordion-flush"
              data-accordion="collapse"
              data-active-classes="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              data-inactive-classes="text-gray-500 dark:text-gray-400"
            >
              {jobs.map((job, i) => (
                <JobRun key={i} job={job} user={user} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const JobRun = ({ job, user }: { job: any; user: any }) => {
  const [loaded, setLoaded] = useState(false);
  const [show, setShow] = useState(false);
  const { id, status, taskName } = job;
  return (
    <>
      <button
        onClick={() => {
          setLoaded(true);
          setShow(!show);
        }}
        type="button"
        className="flex w-full items-center justify-between border-b border-gray-200 py-5 text-left font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        <div className="flex w-full items-center justify-between pr-4">
          <div className="flex items-center gap-x-8">
            <span className="text-xl">Job #{id}</span>
            <Status status={status} />
            <span className="font-regular rounded-full bg-slate-100 px-4 py-1">
              {taskName}
            </span>
          </div>
          <p className="text-sm font-normal text-slate-400">
            last updated {moment(job.lastUpdatedAt).fromNow()}
          </p>
        </div>
        <ChevronDown className="h-6 w-6 text-gray-500" />
      </button>
      <div hidden={!show}>
        {loaded && <JobDetail key={job.id} job={job} user={user} />}
      </div>
    </>
  );
};

const Status = ({ status }: { status: 'pending' | 'failed' | 'complete' }) => {
  if (status === 'pending')
    return (
      <span className="font-regular animate-pulse rounded-full bg-slate-100 px-4 py-1">
        in progress
      </span>
    );
  if (status === 'failed')
    return (
      <span className="font-regular rounded-full bg-red-100 px-4 py-1 text-red-600">
        Failed
      </span>
    );
  if (status === 'complete')
    return (
      <span className="font-regular rounded-full bg-green-100 px-4 py-1 text-green-600">
        Completed
      </span>
    );
  return null;
};

const JobDetail = memo(({ job, user }: { job: any; user: any }) => {
  const data = JSON.parse(job.data);
  const result = JSON.parse(job.result);
  const [rerun, setRerun] = useState(false);
  const [killed, setKilled] = useState(false);

  const rerunJob = async (e: any) => {
    setRerun(true);
    const { job: newJob, error } = await Jobs.retryJob(job.id);
    if (!!newJob) {
      setTimeout(() => {
        e.target.remove();
      }, 2500);
      return;
    }

    alert(error);
    setRerun(false);
    return false;
  };
  const killJob = async (e: any) => {
    setKilled(true);
    await Jobs.kill(job.id);
    setTimeout(() => {
      e.target.remove();
    }, 2500);
    return;
  };

  return (
    <div className='p-2" flex w-full flex-col gap-y-2'>
      {user.role === 'admin' && job.status === 'pending' && (
        <button
          onClick={killJob}
          disabled={killed}
          className="my-2 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-green-500 disabled:hover:bg-green-500"
        >
          {killed ? 'Job is canceled!' : 'Cancel Job'}
        </button>
      )}
      {user.role === 'admin' &&
        job.status === 'failed' &&
        result?.canRetry === true && (
          <button
            onClick={rerunJob}
            disabled={rerun}
            className="my-2 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:bg-green-500 disabled:hover:bg-green-500"
          >
            {rerun ? 'Job is queued!' : 'Re-run Failed Job'}
          </button>
        )}
      <div className="flex w-full items-start gap-x-10 p-2">
        <div className="flex w-1/2 flex-col gap-y-1">
          <p className="text-lg font-semibold">Job Data</p>
          <pre className="overflow-scroll rounded-lg bg-stone-100 p-2 text-stone-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>

        <div className="flex w-1/2 flex-col gap-y-1">
          <p className="text-lg font-semibold">Job Response</p>
          <pre className="overflow-scroll rounded-lg bg-stone-100 p-2 text-stone-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});
