import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { TemplateForm } from '@/components/dashboard/template-form';

export const metadata = { title: 'Новый шаблон' };

interface PageProps {
  searchParams: Promise<{ kind?: 'signature' | 'post' | 'hashtags' }>;
}

export default async function NewTemplatePage({ searchParams }: PageProps) {
  const { kind: defaultKind } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Новый шаблон"
        description="Сохрани кусок контента, который сможешь вставлять в композер одним кликом."
      />

      <Card>
        <CardContent className="pt-5">
          <TemplateForm defaultKind={defaultKind} />
        </CardContent>
      </Card>
    </div>
  );
}
