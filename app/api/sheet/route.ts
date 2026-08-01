export async function POST(req: Request) {
  try {
    const bodyData = await req.json();
    const gasUrl = bodyData.gasUrl || process.env.NEXT_PUBLIC_GAS_URL || process.env.GAS_URL;

    if (!gasUrl) {
      return Response.json({ error: 'GAS_URL이 설정되지 않았습니다.' }, { status: 400 });
    }

    const payload = {
      action: bodyData.action || 'saveSubmission',
      ...bodyData,
      data: bodyData,
    };

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let resData;
    try {
      resData = JSON.parse(text);
    } catch {
      resData = { status: 'success', raw: text };
    }

    return Response.json(resData);
  } catch (error: any) {
    console.error('Sheet API Route Error:', error);
    return Response.json(
      { error: error?.message || '구글 시트 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
