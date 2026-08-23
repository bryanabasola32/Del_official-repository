'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExecutiveDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !company.trim()) {
      toast.error('Name and company are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('contacts').insert({
      name: name.trim(),
      title: title.trim() || null,
      company: company.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      import_status: 'manual',
      persona_status: 'pending',
    });

    if (error) {
      toast.error('Failed to add executive: ' + error.message);
      setSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      action_type: 'add_executive',
      status: 'success',
      description: `Added executive: ${name} — ${title} at ${company}`,
    });

    toast.success(`${name} added to Executive List`);
    onOpenChange(false);
    setName(''); setTitle(''); setCompany(''); setEmail(''); setPhone('');
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Executive
          </DialogTitle>
          <DialogDescription>
            Add a single executive manually. You can generate intelligence for them afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Santos" />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chief Information Officer" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company *</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="BDO Unibank" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="msantos@bdo.com.ph" />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 917 123 4567" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !company.trim()}>
            {saving ? 'Adding...' : 'Add Executive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
