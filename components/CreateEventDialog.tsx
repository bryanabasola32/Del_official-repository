'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CalendarPlus, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const INDUSTRIES = [
  'Banking & Finance', 'Retail', 'Manufacturing', 'BPO',
  'Telecommunications', 'Healthcare', 'Insurance', 'Government',
  'Logistics', 'Real Estate', 'Conglomerates', 'Technology',
];

export function CreateEventDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [industry, setIndustry] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [capacity, setCapacity] = useState('');
  const [organizer, setOrganizer] = useState('DELCA VisionTech Inc.');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error('Event name and description are required');
      return;
    }
    setSaving(true);

    const { primary_theme, target_industries, target_audience: derivedAudience } = deriveFromDescription(description);

    const industries = industry ? [industry, ...target_industries.filter((i) => i !== industry)] : target_industries;
    const finalAudience = targetAudience || derivedAudience;

    const { data, error } = await supabase.from('events').insert({
      event_name: name.trim(),
      date: date || null,
      time: time || null,
      venue: venue.trim() || null,
      organizer: organizer.trim() || null,
      description: description.trim(),
      primary_theme,
      target_industries: industries,
      target_audience: finalAudience,
      max_capacity: capacity ? parseInt(capacity, 10) : null,
      notes: notes.trim() || null,
      status: 'upcoming',
    }).select().maybeSingle();

    if (error || !data) {
      toast.error('Failed to create event: ' + (error?.message || 'Unknown error'));
      setSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      action_type: 'create_event',
      related_event_id: data.id,
      status: 'success',
      description: `Created event: ${name}`,
    });

    toast.success(`Event "${name}" created successfully`);
    onOpenChange(false);
    onCreated?.();
    setName(''); setDescription(''); setVenue(''); setDate(''); setTime('');
    setIndustry(''); setTargetAudience(''); setCapacity(''); setNotes('');
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Create Event
          </DialogTitle>
          <DialogDescription>
            The description is what Del reads to understand the theme and match executives. Be specific about topics and target roles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Event Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AI Leadership Summit 2025" />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A premier gathering of C-suite technology executives exploring AI deployment across banking, finance, and enterprise operations. Sessions cover generative AI, governance, customer experience, and workforce transformation."
              rows={4}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Del will auto-derive theme, target audience, and industries from this description.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Venue</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Manila Hotel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Maximum Capacity</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="100" min="1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="CIOs, CTOs, CDOs from financial services" />
          </div>
          <div className="space-y-2">
            <Label>Organizer</Label>
            <Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this event..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !description.trim()}>
            {saving ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function deriveFromDescription(desc: string) {
  const lower = desc.toLowerCase();
  let primary_theme = 'Technology';
  if (lower.includes('ai') || lower.includes('artificial intelligence')) primary_theme = 'Artificial Intelligence';
  else if (lower.includes('cloud')) primary_theme = 'Cloud Infrastructure';
  else if (lower.includes('cyber') || lower.includes('security')) primary_theme = 'Cybersecurity';
  else if (lower.includes('data')) primary_theme = 'Data & Analytics';
  else if (lower.includes('digital')) primary_theme = 'Digital Transformation';

  const industries: string[] = [];
  const industryMap: Record<string, string[]> = {
    'bank': ['Banking & Finance'], 'finance': ['Banking & Finance'], 'financial': ['Banking & Finance'],
    'retail': ['Retail'], 'manufactur': ['Manufacturing'], 'bpo': ['BPO'],
    'telecom': ['Telecommunications'], 'health': ['Healthcare'], 'insurance': ['Insurance'],
    'government': ['Government'], 'logistics': ['Logistics'], 'real estate': ['Real Estate'],
    'conglomerate': ['Conglomerates'],
  };
  for (const [key, vals] of Object.entries(industryMap)) {
    if (lower.includes(key)) industries.push(...vals);
  }
  if (industries.length === 0) industries.push('Technology');

  let target_audience = 'Senior Executives';
  if (lower.includes('cio')) target_audience = 'Chief Information Officers';
  else if (lower.includes('cto')) target_audience = 'Chief Technology Officers';
  else if (lower.includes('ciso')) target_audience = 'Chief Information Security Officers';
  else if (lower.includes('c-suite') || lower.includes('c level')) target_audience = 'C-Suite Executives';
  else if (lower.includes('director')) target_audience = 'IT Directors';

  return { primary_theme, target_industries: industries, target_audience };
}
