import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/ui/page-header';
import { TemplateForm } from '@/components/dashboard/template-form';

export const metadata = { title: 'Редактировать шаблон' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('templates')
    .select('id, kind, name, content, is_signature')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!template) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Редактировать шаблон"
        description={template.name}
      />
      <Card>
        <CardContent className="pt-5">
          <TemplateForm
            initial={{
              id: template.id,
              kind: template.kind as 'signature' | 'post' | 'hashtags',
              name: template.name,
              content: template.content,
              is_signature: template.is_signature ?? false,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
