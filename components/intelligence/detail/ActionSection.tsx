'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList, Calendar, Mail, MessageSquare, RefreshCw, TrendingUp, ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceDetailData } from './types';

type ActionTab = 'meeting' | 'outreach' | 'conversation' | 'followup' | 'success';

const TABS: { id: ActionTab; label: string; icon: React.ElementType }[] = [
  { id: 'meeting', label: 'Meeting', icon: Calendar },
  { id: 'outreach', label: 'Outreach', icon: Mail },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare },
  { id: 'followup', label: 'Follow-up', icon: RefreshCw },
  { id: 'success', label: 'Success', icon: TrendingUp },
];

export function ActionSection({ data }: { data: IntelligenceDetailData }) {
  const { brief } = data;
  const action = brief?.action;
  const [activeTab, setActiveTab] = useState<ActionTab>('meeting');

  if (!action) return null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <ClipboardList className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold">Action Plan</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-slide-up">
          {activeTab === 'meeting' && action.meetingStrategy && (
            <MeetingTab strategy={action.meetingStrategy} />
          )}
          {activeTab === 'outreach' && action.emailStrategy && (
            <OutreachTab strategy={action.emailStrategy} />
          )}
          {activeTab === 'conversation' && action.conversationFlow && (
            <ConversationTab flow={action.conversationFlow} />
          )}
          {activeTab === 'followup' && action.followUpWorkflow && (
            <FollowUpTab workflow={action.followUpWorkflow} tasks={action.taskList} />
          )}
          {activeTab === 'success' && action.successMetrics && (
            <SuccessTab metrics={action.successMetrics} />
          )}
        </div>
      </Card>
    </div>
  );
}

function MeetingTab({ strategy }: { strategy: NonNullable<IntelligenceDetailData['brief']['action']>['meetingStrategy'] }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Objective</div>
        <p className="text-sm font-medium">{strategy.objective}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{strategy.meetingType}</Badge>
        <span className="text-xs text-muted-foreground">{strategy.duration} min</span>
        {strategy.confidence != null && <Badge variant="outline" className="text-[10px]">{strategy.confidence}% confidence</Badge>}
      </div>
      {strategy.desiredOutcome && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Desired Outcome</div>
          <p className="text-sm">{strategy.desiredOutcome}</p>
        </div>
      )}
      {strategy.recommendedAttendees && strategy.recommendedAttendees.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recommended Attendees</div>
          <div className="space-y-1">
            {strategy.recommendedAttendees.map((att, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[10px]">{att.role}</Badge>
                <span className="text-xs text-muted-foreground">{att.rationale}</span>
                {att.required && <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 text-[10px]">Required</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      {strategy.agenda && strategy.agenda.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Agenda</div>
          <div className="space-y-2">
            {strategy.agenda.map((item, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{item.topic}</span>
                  <span className="text-xs text-muted-foreground">{item.duration} min</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.objective}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {strategy.preparationChecklist && strategy.preparationChecklist.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Preparation Checklist</div>
          <ul className="space-y-1">
            {strategy.preparationChecklist.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OutreachTab({ strategy }: { strategy: NonNullable<IntelligenceDetailData['brief']['action']>['emailStrategy'] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{strategy.tone}</Badge>
        {strategy.callToAction && strategy.callToAction !== 'Unknown' && (
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px]">{strategy.callToAction}</Badge>
        )}
        {strategy.followUpStyle && strategy.followUpStyle !== 'Unknown' && (
          <Badge variant="outline" className="text-[10px]">{strategy.followUpStyle}</Badge>
        )}
      </div>
      {strategy.openingAngle && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Opening Angle</div>
          <p className="text-sm">{strategy.openingAngle}</p>
        </div>
      )}
      {strategy.coreValueProposition && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Core Value Proposition</div>
          <p className="text-sm">{strategy.coreValueProposition}</p>
        </div>
      )}
      {strategy.executiveInterests && strategy.executiveInterests.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Executive Interests</div>
          <div className="flex flex-wrap gap-1">
            {strategy.executiveInterests.map((interest, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{interest}</Badge>
            ))}
          </div>
        </div>
      )}
      {strategy.topicsToHighlight && strategy.topicsToHighlight.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Topics to Highlight</div>
          <div className="flex flex-wrap gap-1">
            {strategy.topicsToHighlight.map((topic, i) => (
              <Badge key={i} className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px]">{topic}</Badge>
            ))}
          </div>
        </div>
      )}
      {strategy.topicsToAvoid && strategy.topicsToAvoid.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Topics to Avoid</div>
          <div className="flex flex-wrap gap-1">
            {strategy.topicsToAvoid.map((topic, i) => (
              <Badge key={i} className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 text-[10px]">{topic}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationTab({ flow }: { flow: NonNullable<IntelligenceDetailData['brief']['action']>['conversationFlow'] }) {
  if (!flow.sections || flow.sections.length === 0) return <p className="text-sm text-muted-foreground">Not yet generated</p>;
  return (
    <div className="space-y-2">
      {flow.sections.map((section, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px]">{section.section}</Badge>
            <span className="text-xs text-muted-foreground">{section.purpose}</span>
          </div>
          {section.talkingPoints && section.talkingPoints.length > 0 && (
            <ul className="text-sm space-y-0.5 mt-1">
              {section.talkingPoints.map((point, j) => (
                <li key={j} className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
          {section.avoidTopics && section.avoidTopics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {section.avoidTopics.map((topic, j) => (
                <Badge key={j} className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 text-[10px]">Avoid: {topic}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FollowUpTab({ workflow, tasks }: {
  workflow: NonNullable<IntelligenceDetailData['brief']['action']>['followUpWorkflow'];
  tasks: NonNullable<IntelligenceDetailData['brief']['action']>['taskList'];
}) {
  return (
    <div className="space-y-4">
      {workflow && workflow.actions && workflow.actions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Follow-up Actions</div>
          <div className="space-y-2">
            {workflow.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-medium shrink-0 mt-0.5">{i + 1}</div>
                <div>
                  <p className="text-sm font-medium">{action.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{action.priority}</Badge>
                    <span className="text-[10px] text-muted-foreground">{action.timing}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tasks && tasks.tasks && tasks.tasks.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Generated Tasks
          </div>
          <div className="space-y-2">
            {tasks.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-medium shrink-0 mt-0.5">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{task.priority}</Badge>
                    <span className="text-[10px] text-muted-foreground">{task.owner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessTab({ metrics }: { metrics: NonNullable<IntelligenceDetailData['brief']['action']>['successMetrics'] }) {
  if (!metrics.metrics || metrics.metrics.length === 0) return <p className="text-sm text-muted-foreground">Not yet generated</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {metrics.metrics.map((metric, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 text-[10px] mb-1">{metric.metric}</Badge>
          <p className="text-sm font-medium">{metric.target}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{metric.measurementMethod}</p>
        </div>
      ))}
    </div>
  );
}
